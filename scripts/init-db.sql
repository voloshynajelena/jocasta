-- Jocasta Database Initialization
-- This script runs when the Postgres container is first created

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create timezone helper function
CREATE OR REPLACE FUNCTION normalize_timestamp_to_tz(
    ts TIMESTAMPTZ,
    tz TEXT DEFAULT 'America/Edmonton'
) RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN ts AT TIME ZONE tz;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant privileges (Prisma will handle schema creation)
GRANT ALL PRIVILEGES ON DATABASE jocasta TO jocasta;
