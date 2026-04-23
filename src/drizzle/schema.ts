import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  serial,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────

export const docTypeEnum = pgEnum("doc_type", [
  "pdf",
  "docx",
  "txt",
  "html",
  "csv",
  "image",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "parsing",
  "chunking",
  "embedding",
  "analyzing",
  "ready",
  "failed",
]);

export const chunkTypeEnum = pgEnum("chunk_type", [
  "text",
  "table",
  "heading",
  "code",
  "list",
  "image_description",
]);

export const ingestionJobStatusEnum = pgEnum("ingestion_job_status", [
  "queued",
  "parsing",
  "chunking",
  "embedding",
  "completed",
  "failed",
]);

export const analysisJobTypeEnum = pgEnum("analysis_job_type", [
  "doc_summary",
  "section_summary",
  "key_entities",
  "full_analysis",
]);

export const analysisJobStatusEnum = pgEnum("analysis_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const bulkAnalysisStatusEnum = pgEnum("bulk_analysis_status", [
  "queued",
  "planning",
  "classifying",
  "processing",
  "aggregating",
  "completed",
  "failed",
]);

// ─── Tables ──────────────────────────────────────────────

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  fullName: text("full_name"),
  phone: varchar("phone", { length: 256 }),
});

export const vaults = pgTable("vaults", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().default("default"),
  fileName: text("file_name").notNull(),
  docType: docTypeEnum("doc_type").notNull(),
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  storagePath: text("storage_path"),
  storageUrl: text("storage_url"),
  language: text("language").default("en"),
  checksum: text("checksum").notNull(),
  status: documentStatusEnum("status").default("pending").notNull(),
  errorMessage: text("error_message"),
  customMetadata: jsonb("custom_metadata").$type<Record<string, unknown>>(),
  uploadTime: timestamp("upload_time", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().default("default"),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  pageNumber: integer("page_number"),
  sectionHeading: text("section_heading"),
  chunkType: chunkTypeEnum("chunk_type").default("text").notNull(),
  pineconeId: text("pinecone_id"),
  embeddingModel: text("embedding_model"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ingestionJobs = pgTable("ingestion_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().default("default"),
  status: ingestionJobStatusEnum("status").default("queued").notNull(),
  totalFiles: integer("total_files").default(0),
  processedFiles: integer("processed_files").default(0),
  failedFiles: integer("failed_files").default(0),
  errorLog: jsonb("error_log").$type<Array<{ docId: string; error: string }>>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const analysisJobs = pgTable("analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().default("default"),
  jobType: analysisJobTypeEnum("job_type").notNull(),
  status: analysisJobStatusEnum("analysis_status").default("queued").notNull(),
  result: jsonb("result").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bulkAnalysisJobs = pgTable("bulk_analysis_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  vaultId: uuid("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  tenantId: text("tenant_id").notNull().default("default"),
  
  userPrompt: text("user_prompt").notNull(),
  plan: jsonb("plan").$type<Record<string, unknown>>(),
  
  totalDocs: integer("total_docs").default(0),
  relevantDocs: integer("relevant_docs").default(0),
  classifiedDocIds: jsonb("classified_doc_ids").$type<Array<{ docId: string; score: number; reason: string }>>(),
  
  status: bulkAnalysisStatusEnum("status").default("queued").notNull(),
  totalShards: integer("total_shards").default(0),
  completedShards: integer("completed_shards").default(0),
  failedShards: integer("failed_shards").default(0),
  shardResults: jsonb("shard_results").$type<Array<Record<string, unknown>>>(),
  
  finalResult: jsonb("final_result").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
  
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Type exports ────────────────────────────────────────

export type Vault = typeof vaults.$inferSelect;
export type NewVault = typeof vaults.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type IngestionJob = typeof ingestionJobs.$inferSelect;
export type NewIngestionJob = typeof ingestionJobs.$inferInsert;
export type AnalysisJob = typeof analysisJobs.$inferSelect;
export type NewAnalysisJob = typeof analysisJobs.$inferInsert;
export type BulkAnalysisJob = typeof bulkAnalysisJobs.$inferSelect;
export type NewBulkAnalysisJob = typeof bulkAnalysisJobs.$inferInsert;