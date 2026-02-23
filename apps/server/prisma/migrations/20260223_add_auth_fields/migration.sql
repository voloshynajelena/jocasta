-- Add authentication fields to users table
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "users" ADD COLUMN "apple_id" TEXT;
ALTER TABLE "users" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- Create unique index for apple_id
CREATE UNIQUE INDEX "users_apple_id_key" ON "users"("apple_id");

-- CreateTable for contacts
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable for event_participants
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'attendee',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable for batch_plan_sessions
CREATE TABLE "batch_plan_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "extracted_data" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_plan_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_user_id_email_key" ON "contacts"("user_id", "email");
CREATE INDEX "contacts_user_id_name_idx" ON "contacts"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_contact_id_key" ON "event_participants"("event_id", "contact_id");

-- CreateIndex
CREATE INDEX "batch_plan_sessions_user_id_status_idx" ON "batch_plan_sessions"("user_id", "status");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_plan_sessions" ADD CONSTRAINT "batch_plan_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
