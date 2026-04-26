-- Fix users table to match schema.ts
-- Add missing columns: auth_id, email, created_at, updated_at

-- Add auth_id column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_id" text;

-- Add email column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text;

-- Add created_at column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Add updated_at column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Make full_name not null
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;

-- Add unique constraints
ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_unique" UNIQUE ("auth_id");
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");

-- Add index on auth_id for faster lookups
CREATE INDEX IF NOT EXISTS "users_auth_id_idx" ON "users" ("auth_id");

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
