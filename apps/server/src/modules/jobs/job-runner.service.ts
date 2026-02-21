import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { NotificationJobProcessor } from './notification-job.processor';
import { SyncJobProcessor } from './sync-job.processor';

@Injectable()
export class JobRunnerService implements OnModuleInit {
  private readonly logger = new Logger(JobRunnerService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationProcessor: NotificationJobProcessor,
    private readonly syncProcessor: SyncJobProcessor,
  ) {}

  onModuleInit() {
    this.logger.log('Job runner initialized');
  }

  /**
   * Process notification jobs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processNotificationJobs() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const jobs = await this.prisma.notificationJob.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() },
          OR: [
            { nextAttemptAt: null },
            { nextAttemptAt: { lte: new Date() } },
          ],
        },
        include: {
          endpoint: true,
        },
        take: 50,
        orderBy: { scheduledFor: 'asc' },
      });

      if (jobs.length > 0) {
        this.logger.log(`Processing ${jobs.length} notification jobs`);
      }

      for (const job of jobs) {
        await this.notificationProcessor.process(job);
      }
    } catch (error) {
      this.logger.error('Error processing notification jobs', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process Google Calendar sync every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processSyncJobs() {
    try {
      // Get users with Google Calendar connected and not in backoff
      const syncStates = await this.prisma.googleSyncState.findMany({
        where: {
          OR: [
            { backoffUntil: null },
            { backoffUntil: { lte: new Date() } },
          ],
        },
        distinct: ['userId'],
      });

      for (const state of syncStates) {
        await this.syncProcessor.processUserSync(state.userId);
      }
    } catch (error) {
      this.logger.error('Error processing sync jobs', error);
    }
  }

  /**
   * Clean up old completed jobs daily
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldJobs() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    const result = await this.prisma.notificationJob.deleteMany({
      where: {
        status: { in: ['sent', 'dead'] },
        updatedAt: { lt: cutoff },
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} old notification jobs`);
    }

    // Clean up old cache entries
    const cacheResult = await this.prisma.directionsCache.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
      },
    });

    if (cacheResult.count > 0) {
      this.logger.log(`Cleaned up ${cacheResult.count} old cache entries`);
    }
  }

  /**
   * Get job queue stats
   */
  async getStats() {
    const [pending, failed, sent] = await Promise.all([
      this.prisma.notificationJob.count({ where: { status: 'pending' } }),
      this.prisma.notificationJob.count({ where: { status: 'failed' } }),
      this.prisma.notificationJob.count({ where: { status: 'sent' } }),
    ]);

    return { pending, failed, sent };
  }
}
