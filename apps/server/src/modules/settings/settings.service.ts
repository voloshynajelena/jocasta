import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DEFAULT_BUFFERS } from '@jocasta/shared';

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
}

export interface UpdateSettingsDto {
  buffers?: Partial<BufferConfig>[];
  reminderMinutesBefore?: number[];
  weatherAlerts?: boolean;
  trafficAlerts?: boolean;
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
      ? (settings.buffers as BufferConfig[])
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
      ? (existing.buffers as BufferConfig[])
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
        buffers: newBuffers,
        ...(updates.reminderMinutesBefore && {
          reminderMinutesBefore: updates.reminderMinutesBefore,
        }),
        ...(updates.weatherAlerts !== undefined && {
          weatherAlerts: updates.weatherAlerts,
        }),
        ...(updates.trafficAlerts !== undefined && {
          trafficAlerts: updates.trafficAlerts,
        }),
      },
      create: {
        userId,
        buffers: newBuffers,
        reminderMinutesBefore: updates.reminderMinutesBefore || [30, 10],
        weatherAlerts: updates.weatherAlerts ?? true,
        trafficAlerts: updates.trafficAlerts ?? true,
      },
    });

    return this.getSettings(userId);
  }
}
