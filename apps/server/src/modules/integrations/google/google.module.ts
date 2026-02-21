import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleController } from './google.controller';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [GoogleController],
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleModule {}
