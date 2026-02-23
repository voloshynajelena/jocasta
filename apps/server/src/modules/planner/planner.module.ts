import { Module } from '@nestjs/common';
import { PlannerService } from './planner.service';
import { PlannerController } from './planner.controller';
import { SlotFinderService } from './slot-finder.service';
import { AIExtractionService } from './ai-extraction.service';
import { BatchExtractionService } from './batch-extraction.service';
import { BatchPlannerService } from './batch-planner.service';
import { EventsModule } from '../events/events.module';
import { TasksModule } from '../tasks/tasks.module';
import { LocationsModule } from '../locations/locations.module';
import { ContactsModule } from '../contacts/contacts.module';
import { DirectionsModule } from '../integrations/directions/directions.module';
import { WeatherModule } from '../integrations/weather/weather.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    EventsModule,
    TasksModule,
    LocationsModule,
    ContactsModule,
    DirectionsModule,
    WeatherModule,
    NotificationsModule,
  ],
  controllers: [PlannerController],
  providers: [
    PlannerService,
    SlotFinderService,
    AIExtractionService,
    BatchExtractionService,
    BatchPlannerService,
  ],
  exports: [PlannerService, BatchPlannerService],
})
export class PlannerModule {}
