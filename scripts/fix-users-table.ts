import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixUsersTable() {
  console.log("🔧 Fixing users table...");

  const sql = `
    -- Add missing columns to users table
    ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "auth_id" text,
      ADD COLUMN IF NOT EXISTS "email" text,
      ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

    -- Make full_name not null
    ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;

    -- Add unique constraints
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'users_auth_id_unique'
      ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_unique" UNIQUE ("auth_id");
      END IF;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'users_email_unique'
      ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");
      END IF;
    END $$;

    -- Add indexes
    CREATE INDEX IF NOT EXISTS "users_auth_id_idx" ON "users" ("auth_id");
    CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      // Try direct SQL via REST API
      console.log("⚠️  RPC failed, trying direct query...");
      
      // Check current columns
      const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_name', 'users')
        .eq('table_schema', 'public');
      
      if (colError) {
        console.error("❌ Error checking columns:", colError.message);
        return;
      }
      
      console.log("Current columns:", columns?.map(c => c.column_name));
      
      // Add columns one by one using raw SQL
      const statements = [
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_id" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" text`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now()`,
        `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now()`,
      ];
      
      for (const stmt of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql: stmt });
        if (error) {
          console.log(`⚠️  Could not execute: ${stmt}`, error.message);
        }
      }
      
      console.log("✅ Migration attempted. Please check if columns were added.");
    } else {
      console.log("✅ Users table fixed successfully!");
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.log("\n📝 Please run this SQL manually in your Supabase SQL Editor:");
    console.log(sql);
  }
}

fixUsersTable();
