-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar_url" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Edmonton',
    "default_transport_mode" TEXT NOT NULL DEFAULT 'sedan',
    "google_refresh_token" TEXT,
    "google_access_token" TEXT,
    "google_token_expires_at" TIMESTAMP(3),
    "home_location_id" TEXT,
    "work_location_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "place_id" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "location_id" TEXT,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'managed',
    "external_provider_id" TEXT,
    "external_etag" TEXT,
    "last_modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recurrence_rule_id" TEXT,
    "parent_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "duration_minutes" INTEGER NOT NULL,
    "duration_minutes_min" INTEGER,
    "duration_minutes_max" INTEGER,
    "location_id" TEXT,
    "window_start_at" TIMESTAMP(3),
    "window_end_at" TIMESTAMP(3),
    "deadline_at" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 2,
    "status" TEXT NOT NULL DEFAULT 'open',
    "scheduled_event_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrence_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rrule" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Edmonton',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurrence_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "constraints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "recurrence_rule_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_segments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_event_id" TEXT,
    "to_event_id" TEXT NOT NULL,
    "from_location_id" TEXT,
    "to_location_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "eta_minutes" INTEGER NOT NULL,
    "depart_at" TIMESTAMP(3) NOT NULL,
    "arrive_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'directions',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "cached_key" TEXT,
    "last_computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weather_impact" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_endpoints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "dedupe_key" TEXT NOT NULL,
    "related_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_sync_states" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "sync_token" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "backoff_until" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "is_managed_calendar" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_cache" (
    "query_hash" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "formatted_address" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ttl_seconds" INTEGER NOT NULL DEFAULT 604800,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geo_cache_pkey" PRIMARY KEY ("query_hash")
);

-- CreateTable
CREATE TABLE "directions_cache" (
    "cache_key" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "from_latitude" DOUBLE PRECISION NOT NULL,
    "from_longitude" DOUBLE PRECISION NOT NULL,
    "to_latitude" DOUBLE PRECISION NOT NULL,
    "to_longitude" DOUBLE PRECISION NOT NULL,
    "depart_bucket" TEXT NOT NULL,
    "eta_minutes" INTEGER NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "polyline" TEXT,
    "provider" TEXT NOT NULL,
    "ttl_seconds" INTEGER NOT NULL DEFAULT 3600,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directions_cache_pkey" PRIMARY KEY ("cache_key")
);

-- CreateTable
CREATE TABLE "weather_cache" (
    "id" TEXT NOT NULL,
    "location_hash" TEXT NOT NULL,
    "time_bucket" TEXT NOT NULL,
    "forecast_json" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "ttl_seconds" INTEGER NOT NULL DEFAULT 3600,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "buffers" JSONB NOT NULL DEFAULT '[]',
    "reminder_minutes_before" JSONB NOT NULL DEFAULT '[30, 10]',
    "weather_alerts" BOOLEAN NOT NULL DEFAULT true,
    "traffic_alerts" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_queue" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "events_user_id_start_at_idx" ON "events"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "events_user_id_source_idx" ON "events"("user_id", "source");

-- CreateIndex
CREATE INDEX "events_external_provider_id_idx" ON "events"("external_provider_id");

-- CreateIndex
CREATE INDEX "tasks_user_id_status_idx" ON "tasks"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_endpoints_user_id_channel_address_key" ON "notification_endpoints"("user_id", "channel", "address");

-- CreateIndex
CREATE INDEX "notification_jobs_status_scheduled_for_idx" ON "notification_jobs"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "notification_jobs_user_id_status_idx" ON "notification_jobs"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");

-- CreateIndex
CREATE UNIQUE INDEX "google_sync_states_user_id_calendar_id_key" ON "google_sync_states"("user_id", "calendar_id");

-- CreateIndex
CREATE UNIQUE INDEX "weather_cache_location_hash_time_bucket_key" ON "weather_cache"("location_hash", "time_bucket");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "user_settings"("user_id");

-- CreateIndex
CREATE INDEX "job_queue_status_run_at_priority_idx" ON "job_queue"("status", "run_at", "priority");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_home_location_id_fkey" FOREIGN KEY ("home_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_work_location_id_fkey" FOREIGN KEY ("work_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_scheduled_event_id_fkey" FOREIGN KEY ("scheduled_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "constraints" ADD CONSTRAINT "constraints_recurrence_rule_id_fkey" FOREIGN KEY ("recurrence_rule_id") REFERENCES "recurrence_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_segments" ADD CONSTRAINT "travel_segments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_segments" ADD CONSTRAINT "travel_segments_to_event_id_fkey" FOREIGN KEY ("to_event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_segments" ADD CONSTRAINT "travel_segments_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_segments" ADD CONSTRAINT "travel_segments_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_endpoints" ADD CONSTRAINT "notification_endpoints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "notification_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_related_event_id_fkey" FOREIGN KEY ("related_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_sync_states" ADD CONSTRAINT "google_sync_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
