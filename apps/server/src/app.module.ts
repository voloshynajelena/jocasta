import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Config
import configuration from './config/configuration';

// Database
import { DatabaseModule } from './database/database.module';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EventsModule } from './modules/events/events.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { PlannerModule } from './modules/planner/planner.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { JobsModule } from './modules/jobs/jobs.module';

// Integrations
import { GoogleModule } from './modules/integrations/google/google.module';
import { TelegramModule } from './modules/integrations/telegram/telegram.module';
import { DirectionsModule } from './modules/integrations/directions/directions.module';
import { WeatherModule } from './modules/integrations/weather/weather.module';

// Health check
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Scheduling for cron jobs
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // Core modules
    AuthModule,
    UsersModule,
    EventsModule,
    TasksModule,
    LocationsModule,
    ContactsModule,
    PlannerModule,
    NotificationsModule,
    SettingsModule,
    JobsModule,

    // Integrations
    GoogleModule,
    TelegramModule,
    DirectionsModule,
    WeatherModule,

    // Health
    HealthModule,
  ],
})
export class AppModule {}
