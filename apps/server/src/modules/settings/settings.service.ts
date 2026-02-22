import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_BUFFERS } from '@jocasta/shared';
import { Prisma } from '@prisma/client';

export interface BufferConfig {
  eventType: string;
  beforeMinutes: number;
  afterMinutes: number;
}

export interface UserSettings {
  buffers: BufferConfig[];
  constraints: any[];
  notifications: {
    reminderMinutesBefore: number[];
    weatherAlerts: boolean;
    trafficAlerts: boolean;
  };
  googleCalendar: {
    lockGoogleEvents: boolean;
    includeGoogleInPlanning: boolean;
  };
}

export interface UpdateSettingsDto {
  buffers?: Partial<BufferConfig>[];
  reminderMinutesBefore?: number[];
  weatherAlerts?: boolean;
  trafficAlerts?: boolean;
  lockGoogleEvents?: boolean;
  includeGoogleInPlanning?: boolean;
}

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string): Promise<UserSettings> {
    const [settings, constraints] = await Promise.all([
      this.prisma.userSettings.findUnique({
        where: { userId },
      }),
      this.prisma.constraint.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const buffers = settings?.buffers
      ? (settings.buffers as unknown as BufferConfig[])
      : DEFAULT_BUFFERS;

    const reminderMinutesBefore = settings?.reminderMinutesBefore
      ? (settings.reminderMinutesBefore as number[])
      : [30, 10];

    return {
      buffers,
      constraints,
      notifications: {
        reminderMinutesBefore,
        weatherAlerts: settings?.weatherAlerts ?? true,
        trafficAlerts: settings?.trafficAlerts ?? true,
      },
      googleCalendar: {
        lockGoogleEvents: settings?.lockGoogleEvents ?? true,
        includeGoogleInPlanning: settings?.includeGoogleInPlanning ?? true,
      },
    };
  }

  async updateSettings(
    userId: string,
    updates: UpdateSettingsDto,
  ): Promise<UserSettings> {
    const existing = await this.prisma.userSettings.findUnique({
      where: { userId },
    });

    const currentBuffers = existing?.buffers
      ? (existing.buffers as unknown as BufferConfig[])
      : [...DEFAULT_BUFFERS];

    // Merge buffer updates
    let newBuffers = currentBuffers;
    if (updates.buffers) {
      newBuffers = currentBuffers.map((buffer) => {
        const update = updates.buffers?.find(
          (u) => u.eventType === buffer.eventType,
        );
        if (update) {
          return {
            ...buffer,
            ...(update.beforeMinutes !== undefined && {
              beforeMinutes: update.beforeMinutes,
            }),
            ...(update.afterMinutes !== undefined && {
              afterMinutes: update.afterMinutes,
            }),
          };
        }
        return buffer;
      });
    }

    await this.prisma.userSettings.upsert({
      where: { userId },
      update: {
        buffers: newBuffers as unknown as Prisma.InputJsonValue,
        ...(updates.reminderMinutesBefore && {
          reminderMinutesBefore: updates.reminderMinutesBefore,
        }),
        ...(updates.weatherAlerts !== undefined && {
          weatherAlerts: updates.weatherAlerts,
        }),
        ...(updates.trafficAlerts !== undefined && {
          trafficAlerts: updates.trafficAlerts,
        }),
        ...(updates.lockGoogleEvents !== undefined && {
          lockGoogleEvents: updates.lockGoogleEvents,
        }),
        ...(updates.includeGoogleInPlanning !== undefined && {
          includeGoogleInPlanning: updates.includeGoogleInPlanning,
        }),
      },
      create: {
        userId,
        buffers: newBuffers as unknown as Prisma.InputJsonValue,
        reminderMinutesBefore: updates.reminderMinutesBefore || [30, 10],
        weatherAlerts: updates.weatherAlerts ?? true,
        trafficAlerts: updates.trafficAlerts ?? true,
        lockGoogleEvents: updates.lockGoogleEvents ?? true,
        includeGoogleInPlanning: updates.includeGoogleInPlanning ?? true,
      },
    });

    // If lockGoogleEvents setting changed, update all existing Google events
    if (updates.lockGoogleEvents !== undefined) {
      await this.prisma.event.updateMany({
        where: {
          userId,
          source: 'external_google',
        },
        data: {
          isLocked: updates.lockGoogleEvents,
        },
      });
    }

    return this.getSettings(userId);
  }
}
