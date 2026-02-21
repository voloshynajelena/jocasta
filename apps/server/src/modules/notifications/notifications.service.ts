import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { utils } from '@jocasta/shared';

export interface NotificationPayload {
  type: 'reminder' | 'proposal' | 'confirmation' | 'warning' | 'alert';
  title: string;
  body: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    id: string;
    label: string;
    type: string;
    payload?: Record<string, unknown>;
  }>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Schedule reminders for an event
   */
  async scheduleEventReminders(
    userId: string,
    eventId: string,
    eventStartAt: Date,
  ): Promise<number> {
    // Get user settings for reminder times
    const settings = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const reminderMinutes = (settings?.reminderMinutesBefore as number[]) || [30, 10];

    // Get enabled notification endpoints
    const endpoints = await this.prisma.notificationEndpoint.findMany({
      where: { userId, isEnabled: true, isVerified: true },
    });

    if (endpoints.length === 0) {
      return 0;
    }

    // Get event details
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { location: true },
    });

    if (!event) {
      return 0;
    }

    let scheduled = 0;

    for (const endpoint of endpoints) {
      for (const minutes of reminderMinutes) {
        const scheduledFor = utils.subtractMinutes(eventStartAt, minutes);

        // Don't schedule if already in the past
        if (scheduledFor <= new Date()) {
          continue;
        }

        const dedupeKey = `reminder:${eventId}:${endpoint.id}:${minutes}`;

        // Check if already scheduled
        const existing = await this.prisma.notificationJob.findUnique({
          where: { dedupeKey },
        });

        if (existing) {
          continue;
        }

        const payload: NotificationPayload = {
          type: 'reminder',
          title: `${event.title} in ${minutes} minutes`,
          body: event.location
            ? `📍 ${event.location.name}`
            : 'No location set',
          data: {
            eventId: event.id,
            type: 'event_reminder',
          },
          actions: [
            { id: 'dismiss', label: '✓ OK', type: 'dismiss' },
            { id: 'snooze', label: '⏰ Snooze 5m', type: 'snooze', payload: { minutes: 5 } },
          ],
        };

        await this.prisma.notificationJob.create({
          data: {
            id: uuidv4(),
            userId,
            channel: endpoint.channel,
            endpointId: endpoint.id,
            payload: payload as unknown as Prisma.InputJsonValue,
            scheduledFor,
            status: 'pending',
            dedupeKey,
            relatedEventId: eventId,
          },
        });

        scheduled++;
      }
    }

    this.logger.log(`Scheduled ${scheduled} reminders for event ${eventId}`);
    return scheduled;
  }

  /**
   * Schedule a travel departure notification
   */
  async scheduleTravelNotification(
    userId: string,
    eventId: string,
    departAt: Date,
    destination: string,
    etaMinutes: number,
  ): Promise<void> {
    const endpoints = await this.prisma.notificationEndpoint.findMany({
      where: { userId, isEnabled: true, isVerified: true },
    });

    for (const endpoint of endpoints) {
      const dedupeKey = `travel:${eventId}:${endpoint.id}`;

      const existing = await this.prisma.notificationJob.findUnique({
        where: { dedupeKey },
      });

      if (existing) {
        continue;
      }

      const payload: NotificationPayload = {
        type: 'alert',
        title: `🚗 Leave now for ${destination}`,
        body: `${etaMinutes} min drive`,
        data: {
          eventId,
          type: 'travel_alert',
        },
        actions: [
          { id: 'acknowledge', label: '✓ On my way', type: 'dismiss' },
          { id: 'delay', label: '⏰ Delay 10m', type: 'snooze', payload: { minutes: 10 } },
        ],
      };

      await this.prisma.notificationJob.create({
        data: {
          id: uuidv4(),
          userId,
          channel: endpoint.channel,
          endpointId: endpoint.id,
          payload: payload as unknown as Prisma.InputJsonValue,
          scheduledFor: departAt,
          status: 'pending',
          dedupeKey,
          relatedEventId: eventId,
        },
      });
    }
  }

  /**
   * Send a notification immediately (for proposals, confirmations, etc.)
   */
  async sendImmediateNotification(
    userId: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const endpoints = await this.prisma.notificationEndpoint.findMany({
      where: { userId, isEnabled: true, isVerified: true },
    });

    for (const endpoint of endpoints) {
      await this.prisma.notificationJob.create({
        data: {
          id: uuidv4(),
          userId,
          channel: endpoint.channel,
          endpointId: endpoint.id,
          payload: payload as unknown as Prisma.InputJsonValue,
          scheduledFor: new Date(),
          status: 'pending',
          dedupeKey: `immediate:${uuidv4()}`,
        },
      });
    }
  }

  /**
   * Cancel notifications for an event
   */
  async cancelEventNotifications(eventId: string): Promise<number> {
    const result = await this.prisma.notificationJob.updateMany({
      where: {
        relatedEventId: eventId,
        status: 'pending',
      },
      data: {
        status: 'dead',
        lastError: 'Event cancelled or modified',
      },
    });

    return result.count;
  }

  /**
   * Get pending notifications for a user
   */
  async getPendingNotifications(userId: string) {
    return this.prisma.notificationJob.findMany({
      where: {
        userId,
        status: { in: ['pending', 'failed'] },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 50,
    });
  }

  /**
   * Register a notification endpoint
   */
  async registerEndpoint(
    userId: string,
    channel: string,
    address: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.prisma.notificationEndpoint.upsert({
      where: {
        userId_channel_address: { userId, channel, address },
      },
      update: {
        isEnabled: true,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
      create: {
        userId,
        channel,
        address,
        isEnabled: true,
        isVerified: false,
        metadata: metadata as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Verify a notification endpoint
   */
  async verifyEndpoint(userId: string, channel: string, address: string): Promise<void> {
    await this.prisma.notificationEndpoint.updateMany({
      where: { userId, channel, address },
      data: { isVerified: true },
    });
  }
}
