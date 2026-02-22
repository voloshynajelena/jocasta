import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleController } from './google.controller';
import { EventParserService } from './event-parser.service';
import { EventsModule } from '../../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [GoogleController],
  providers: [GoogleCalendarService, EventParserService],
  exports: [GoogleCalendarService, EventParserService],
})
export class GoogleModule {}
