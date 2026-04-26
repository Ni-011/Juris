ALTER TABLE "chat_sessions" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_share_token_unique" UNIQUE("share_token");