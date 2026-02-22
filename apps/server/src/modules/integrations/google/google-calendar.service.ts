import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../database/prisma.service';
import { EventParserService } from './event-parser.service';
import { google, calendar_v3 } from 'googleapis';
import * as crypto from 'crypto';

const MANAGED_CALENDAR_NAME = 'Jocasta Managed';
const APP_EVENT_KEY = 'app_event_id';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventParser: EventParserService,
  ) {
    this.clientId = this.configService.get('google.clientId') || '';
    this.clientSecret = this.configService.get('google.clientSecret') || '';

    const key = this.configService.get<string>('encryption.key');
    this.encryptionKey = crypto.scryptSync(key || 'default-key', 'salt', 32);
  }

  /**
   * Check if Google Calendar is configured
   */
  isConfigured(): boolean {
    return !!this.clientId && !!this.clientSecret;
  }

  /**
   * Get OAuth2 client for a user
   */
  private async getOAuth2Client(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleRefreshToken: true,
        googleAccessToken: true,
        googleTokenExpiresAt: true,
      },
    });

    if (!user?.googleRefreshToken) {
      throw new Error('User has no Google Calendar connection');
    }

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
    );

    const refreshToken = this.decrypt(user.googleRefreshToken);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Refresh access token if expired
    if (!user.googleAccessToken || !user.googleTokenExpiresAt || user.googleTokenExpiresAt < new Date()) {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      // Update stored tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          googleAccessToken: this.encrypt(credentials.access_token!),
          googleTokenExpiresAt: new Date(credentials.expiry_date!),
        },
      });
    } else {
      oauth2Client.setCredentials({
        access_token: this.decrypt(user.googleAccessToken),
        refresh_token: refreshToken,
      });
    }

    return oauth2Client;
  }

  /**
   * Get or create the managed calendar
   */
  async getOrCreateManagedCalendar(userId: string): Promise<string> {
    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Check if we have a stored managed calendar ID
    const syncState = await this.prisma.googleSyncState.findFirst({
      where: { userId, isManagedCalendar: true },
    });

    if (syncState) {
      // Verify calendar still exists
      try {
        await calendar.calendars.get({ calendarId: syncState.calendarId });
        return syncState.calendarId;
      } catch (error) {
        // Calendar was deleted, remove sync state
        await this.prisma.googleSyncState.delete({ where: { id: syncState.id } });
      }
    }

    // Search for existing managed calendar
    const calendarList = await calendar.calendarList.list();
    const existingManaged = calendarList.data.items?.find(
      (cal) => cal.summary === MANAGED_CALENDAR_NAME,
    );

    if (existingManaged?.id) {
      await this.prisma.googleSyncState.create({
        data: {
          userId,
          calendarId: existingManaged.id,
          isManagedCalendar: true,
        },
      });
      return existingManaged.id;
    }

    // Create new managed calendar
    const newCalendar = await calendar.calendars.insert({
      requestBody: {
        summary: MANAGED_CALENDAR_NAME,
        description: 'Events managed by Jocasta Scheduler',
        timeZone: 'America/Edmonton',
      },
    });

    await this.prisma.googleSyncState.create({
      data: {
        userId,
        calendarId: newCalendar.data.id!,
        isManagedCalendar: true,
      },
    });

    return newCalendar.data.id!;
  }

  /**
   * Sync events from Google Calendar
   */
  async syncFromGoogle(userId: string): Promise<{
    imported: number;
    updated: number;
    deleted: number;
  }> {
    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get sync state
    let syncState = await this.prisma.googleSyncState.findFirst({
      where: { userId, calendarId: 'primary' },
    });

    // Check backoff
    if (syncState?.backoffUntil && syncState.backoffUntil > new Date()) {
      this.logger.warn(`Sync backoff active until ${syncState.backoffUntil}`);
      return { imported: 0, updated: 0, deleted: 0 };
    }

    let imported = 0;
    let updated = 0;
    let deleted = 0;

    try {
      // Start from beginning of today (in user's timezone, approximated as UTC-7 for Edmonton)
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId: 'primary',
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: startOfToday.toISOString(),
        timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      if (syncState?.syncToken) {
        params.syncToken = syncState.syncToken;
        delete params.timeMin;
        delete params.timeMax;
      }

      const response = await calendar.events.list(params);
      const events = response.data.items || [];

      for (const googleEvent of events) {
        if (!googleEvent.id) continue;

        // Skip events from our managed calendar
        if (googleEvent.extendedProperties?.private?.[APP_EVENT_KEY]) {
          continue;
        }

        // Handle deleted events
        if (googleEvent.status === 'cancelled') {
          const existing = await this.prisma.event.findFirst({
            where: { userId, externalProviderId: googleEvent.id },
          });
          if (existing) {
            await this.prisma.event.delete({ where: { id: existing.id } });
            deleted++;
          }
          continue;
        }

        // Parse event data
        const startAt = googleEvent.start?.dateTime
          ? new Date(googleEvent.start.dateTime)
          : googleEvent.start?.date
            ? new Date(googleEvent.start.date)
            : null;

        const endAt = googleEvent.end?.dateTime
          ? new Date(googleEvent.end.dateTime)
          : googleEvent.end?.date
            ? new Date(googleEvent.end.date)
            : null;

        if (!startAt || !endAt) continue;

        // Parse the Google event to extract meaningful data
        const parsedEvent = this.eventParser.parseGoogleEvent(googleEvent);

        // Get user settings for lock preference
        const userSettings = await this.prisma.userSettings.findUnique({
          where: { userId },
        });
        const shouldLock = userSettings?.lockGoogleEvents ?? true;

        // Store original Google event data for reference
        const externalData = JSON.parse(JSON.stringify({
          id: googleEvent.id,
          summary: googleEvent.summary,
          description: googleEvent.description,
          location: googleEvent.location,
          start: googleEvent.start,
          end: googleEvent.end,
          attendees: googleEvent.attendees,
          organizer: googleEvent.organizer,
          colorId: googleEvent.colorId,
          recurringEventId: googleEvent.recurringEventId,
          htmlLink: googleEvent.htmlLink,
        }));

        // Check if event exists
        const existing = await this.prisma.event.findFirst({
          where: { userId, externalProviderId: googleEvent.id },
        });

        if (existing) {
          // Check if changed
          if (existing.externalEtag !== googleEvent.etag) {
            await this.prisma.event.update({
              where: { id: existing.id },
              data: {
                title: parsedEvent.title,
                type: parsedEvent.type,
                startAt,
                endAt,
                priority: parsedEvent.priority,
                notes: parsedEvent.notes || existing.notes,
                externalEtag: googleEvent.etag,
                externalData,
                lastModifiedAt: new Date(),
              },
            });
            updated++;
          }
        } else {
          await this.prisma.event.create({
            data: {
              userId,
              title: parsedEvent.title,
              type: parsedEvent.type,
              startAt,
              endAt,
              isLocked: shouldLock,
              priority: parsedEvent.priority,
              notes: parsedEvent.notes,
              source: 'external_google',
              externalProviderId: googleEvent.id,
              externalEtag: googleEvent.etag,
              externalData,
            },
          });
          imported++;
        }
      }

      // Update sync state
      if (response.data.nextSyncToken) {
        if (syncState) {
          await this.prisma.googleSyncState.update({
            where: { id: syncState.id },
            data: {
              syncToken: response.data.nextSyncToken,
              lastSyncAt: new Date(),
              failureCount: 0,
              backoffUntil: null,
            },
          });
        } else {
          await this.prisma.googleSyncState.create({
            data: {
              userId,
              calendarId: 'primary',
              syncToken: response.data.nextSyncToken,
              lastSyncAt: new Date(),
            },
          });
        }
      }

      this.logger.log(
        `Sync complete: ${imported} imported, ${updated} updated, ${deleted} deleted`,
      );
    } catch (error: any) {
      this.logger.error('Sync failed', error);

      // Handle 410 Gone - need full sync
      if (error.code === 410) {
        if (syncState) {
          await this.prisma.googleSyncState.update({
            where: { id: syncState.id },
            data: { syncToken: null },
          });
        }
        return this.syncFromGoogle(userId);
      }

      // Apply exponential backoff
      const failureCount = (syncState?.failureCount || 0) + 1;
      const backoffMinutes = Math.min(Math.pow(2, failureCount), 60);
      const backoffUntil = new Date(Date.now() + backoffMinutes * 60 * 1000);

      if (syncState) {
        await this.prisma.googleSyncState.update({
          where: { id: syncState.id },
          data: { failureCount, backoffUntil },
        });
      }

      throw error;
    }

    return { imported, updated, deleted };
  }

  /**
   * Push a managed event to Google Calendar
   */
  async pushEventToGoogle(
    userId: string,
    eventId: string,
  ): Promise<string | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { location: true },
    });

    if (!event || event.userId !== userId || event.source !== 'managed') {
      return null;
    }

    const oauth2Client = await this.getOAuth2Client(userId);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const calendarId = await this.getOrCreateManagedCalendar(userId);

    const googleEvent: calendar_v3.Schema$Event = {
      summary: event.title,
      start: {
        dateTime: event.startAt.toISOString(),
        timeZone: 'America/Edmonton',
      },
      end: {
        dateTime: event.endAt.toISOString(),
        timeZone: 'America/Edmonton',
      },
      location: event.location?.address,
      extendedProperties: {
        private: {
          [APP_EVENT_KEY]: event.id,
        },
      },
    };

    try {
      if (event.externalProviderId) {
        // Update existing
        const response = await calendar.events.update({
          calendarId,
          eventId: event.externalProviderId,
          requestBody: googleEvent,
        });
        return response.data.id || null;
      } else {
        // Create new
        const response = await calendar.events.insert({
          calendarId,
          requestBody: googleEvent,
        });

        // Store Google event ID
        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            externalProviderId: response.data.id,
            externalEtag: response.data.etag,
          },
        });

        return response.data.id || null;
      }
    } catch (error) {
      this.logger.error('Failed to push event to Google', error);
      return null;
    }
  }

  /**
   * Get sync status for user
   */
  async getSyncStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    });

    const syncStates = await this.prisma.googleSyncState.findMany({
      where: { userId },
    });

    const managedCalendar = syncStates.find((s) => s.isManagedCalendar);
    const primarySync = syncStates.find((s) => s.calendarId === 'primary');

    return {
      isConnected: !!user?.googleRefreshToken,
      lastSyncAt: primarySync?.lastSyncAt?.toISOString() || null,
      managedCalendarId: managedCalendar?.calendarId || null,
      syncErrors: syncStates
        .filter((s) => s.failureCount > 0)
        .map((s) => `Calendar ${s.calendarId}: ${s.failureCount} failures`),
    };
  }

  // Encryption helpers
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
