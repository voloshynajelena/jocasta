import { Module } from '@nestjs/common';
import { JobRunnerService } from './job-runner.service';
import { NotificationJobProcessor } from './notification-job.processor';
import { SyncJobProcessor } from './sync-job.processor';
import { TelegramModule } from '../integrations/telegram/telegram.module';
import { GoogleModule } from '../integrations/google/google.module';

@Module({
  imports: [TelegramModule, GoogleModule],
  providers: [JobRunnerService, NotificationJobProcessor, SyncJobProcessor],
  exports: [JobRunnerService],
})
export class JobsModule {}
