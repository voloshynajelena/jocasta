import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarService } from '../integrations/google/google-calendar.service';

@Injectable()
export class SyncJobProcessor {
  private readonly logger = new Logger(SyncJobProcessor.name);

  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  async processUserSync(userId: string): Promise<void> {
    try {
      this.logger.debug(`Starting sync for user ${userId}`);
      const result = await this.googleCalendarService.syncFromGoogle(userId);
      this.logger.log(
        `Sync complete for user ${userId}: ${result.imported} imported, ${result.updated} updated, ${result.deleted} deleted`,
      );
    } catch (error: any) {
      this.logger.error(`Sync failed for user ${userId}: ${error.message}`);
    }
  }
}
