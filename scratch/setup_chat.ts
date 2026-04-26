import postgres from "postgres";
import "dotenv/config";

async function setupChatTables() {
  const connectionString = process.env.DATABASE_URL!;
  const sql = postgres(connectionString, { prepare: false });

  try {
    console.log("Creating chat tables...");
    
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "chat_sessions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "tenant_id" text DEFAULT 'default' NOT NULL,
        "title" text DEFAULT 'New Chat' NOT NULL,
        "vault_id" uuid,
        "share_token" text UNIQUE,
        "is_public" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" uuid NOT NULL,
        "tenant_id" text DEFAULT 'default' NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );

      -- Add foreign keys if they don't exist
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_sessions_vault_id_vaults_id_fk') THEN
          ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chat_messages_session_id_chat_sessions_id_fk') THEN
          ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
        END IF;
      END $$;
    `);

    console.log("Chat tables setup successfully!");

  } catch (error) {
    console.error("Setup failed:", error);
  } finally {
    await sql.end();
  }
}

setupChatTables();
