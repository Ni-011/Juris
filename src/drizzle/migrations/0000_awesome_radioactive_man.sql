CREATE TYPE "public"."analysis_job_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."analysis_job_type" AS ENUM('doc_summary', 'section_summary', 'key_entities', 'full_analysis');--> statement-breakpoint
CREATE TYPE "public"."bulk_analysis_status" AS ENUM('queued', 'planning', 'classifying', 'processing', 'aggregating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."chunk_type" AS ENUM('text', 'table', 'heading', 'code', 'list', 'image_description');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('pdf', 'docx', 'txt', 'html', 'csv', 'image');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'parsing', 'chunking', 'embedding', 'analyzing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ingestion_job_status" AS ENUM('queued', 'parsing', 'chunking', 'embedding', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"job_type" "analysis_job_type" NOT NULL,
	"analysis_status" "analysis_job_status" DEFAULT 'queued' NOT NULL,
	"result" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_analysis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"user_prompt" text NOT NULL,
	"plan" jsonb,
	"total_docs" integer DEFAULT 0,
	"relevant_docs" integer DEFAULT 0,
	"classified_doc_ids" jsonb,
	"status" "bulk_analysis_status" DEFAULT 'queued' NOT NULL,
	"total_shards" integer DEFAULT 0,
	"completed_shards" integer DEFAULT 0,
	"failed_shards" integer DEFAULT 0,
	"shard_results" jsonb,
	"final_result" jsonb,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"vault_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"page_number" integer,
	"section_heading" text,
	"chunk_type" "chunk_type" DEFAULT 'text' NOT NULL,
	"pinecone_id" text,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"file_name" text NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"file_size" integer,
	"page_count" integer,
	"storage_path" text,
	"storage_url" text,
	"language" text DEFAULT 'en',
	"checksum" text NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"custom_metadata" jsonb,
	"upload_time" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_id" uuid NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"status" "ingestion_job_status" DEFAULT 'queued' NOT NULL,
	"total_files" integer DEFAULT 0,
	"processed_files" integer DEFAULT 0,
	"failed_files" integer DEFAULT 0,
	"error_log" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"full_name" text,
	"phone" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "vaults" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text DEFAULT 'default' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_analysis_jobs" ADD CONSTRAINT "bulk_analysis_jobs_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_vault_id_vaults_id_fk" FOREIGN KEY ("vault_id") REFERENCES "public"."vaults"("id") ON DELETE cascade ON UPDATE no action;