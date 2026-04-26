-- Run this SQL in your Supabase SQL Editor to fix the users table

-- Add missing columns to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_id" text,
  ADD COLUMN IF NOT EXISTS "email" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now();

-- Make full_name not null (if there are existing rows with null values, set them first)
-- UPDATE "users" SET "full_name" = 'Unknown' WHERE "full_name" IS NULL;
-- ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;

-- Add unique constraints
-- First drop if exists to avoid errors
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_auth_id_unique";
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";

-- Add the constraints
ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_unique" UNIQUE ("auth_id");
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS "users_auth_id_idx" ON "users" ("auth_id");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND table_schema = 'public'
ORDER BY ordinal_position;
