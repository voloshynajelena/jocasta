import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramService } from '../integrations/telegram/telegram.service';
import { NotificationJob, NotificationEndpoint } from '@prisma/client';

type JobWithEndpoint = NotificationJob & { endpoint: NotificationEndpoint };

@Injectable()
export class NotificationJobProcessor {
  private readonly logger = new Logger(NotificationJobProcessor.name);
  private readonly maxAttempts = 3;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  async process(job: JobWithEndpoint): Promise<void> {
    this.logger.debug(`Processing job ${job.id} (attempt ${job.attempts + 1})`);

    try {
      let success = false;

      switch (job.channel) {
        case 'telegram':
          success = await this.sendTelegram(job);
          break;
        case 'expo_push':
          success = await this.sendExpoPush(job);
          break;
        default:
          this.logger.warn(`Unknown channel: ${job.channel}`);
          await this.markAsDead(job, 'Unknown channel');
          return;
      }

      if (success) {
        await this.markAsSent(job);
      } else {
        await this.handleFailure(job, 'Send returned false');
      }
    } catch (error: any) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      await this.handleFailure(job, error.message);
    }
  }

  private async sendTelegram(job: JobWithEndpoint): Promise<boolean> {
    const payload = job.payload as any;

    // Build message text
    let text = `<b>${payload.title}</b>\n\n${payload.body}`;

    // Build buttons if present
    const buttons = payload.actions?.map((action: any) => ({
      text: action.label,
      callbackData: `${action.type}:${action.payload?.minutes || ''}`,
    }));

    return this.telegramService.sendMessage(job.endpoint.address, text, {
      parseMode: 'HTML',
      buttons: buttons ? [buttons] : undefined,
    });
  }

  private async sendExpoPush(job: JobWithEndpoint): Promise<boolean> {
    // Expo push notification implementation
    // For MVP, we'll just log it - full implementation requires expo-server-sdk
    this.logger.log(`Would send Expo push to ${job.endpoint.address}`);

    // TODO: Implement with expo-server-sdk
    // const { Expo } = require('expo-server-sdk');
    // const expo = new Expo();
    // const messages = [{ to: job.endpoint.address, ... }];
    // const tickets = await expo.sendPushNotificationsAsync(messages);

    return true;
  }

  private async markAsSent(job: NotificationJob): Promise<void> {
    await this.prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'sent',
        lastAttemptAt: new Date(),
      },
    });
    this.logger.debug(`Job ${job.id} sent successfully`);
  }

  private async handleFailure(job: NotificationJob, error: string): Promise<void> {
    const newAttempts = job.attempts + 1;

    if (newAttempts >= this.maxAttempts) {
      await this.markAsDead(job, error);
      return;
    }

    // Calculate exponential backoff
    const backoffMinutes = Math.pow(2, newAttempts);
    const nextAttemptAt = new Date(Date.now() + backoffMinutes * 60 * 1000);

    await this.prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        attempts: newAttempts,
        lastError: error,
        lastAttemptAt: new Date(),
        nextAttemptAt,
      },
    });

    this.logger.warn(
      `Job ${job.id} failed (attempt ${newAttempts}), next attempt at ${nextAttemptAt}`,
    );
  }

  private async markAsDead(job: NotificationJob, error: string): Promise<void> {
    await this.prisma.notificationJob.update({
      where: { id: job.id },
      data: {
        status: 'dead',
        lastError: error,
        lastAttemptAt: new Date(),
      },
    });
    this.logger.error(`Job ${job.id} marked as dead after max attempts`);
  }
}
