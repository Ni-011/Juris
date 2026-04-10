import { db } from "@/lib/db";
import {
  documents,
  documentChunks,
  ingestionJobs,
  analysisJobs,
} from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { generateEmbeddings, EMBEDDING_MODEL } from "@/lib/embeddings";
import {
  upsertVectors,
  deleteDocumentVectors,
  type UpsertVector,
  type VectorMetadata,
} from "@/lib/pinecone";
import OpenAI from "openai";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8100";

// ─── Types ───────────────────────────────────────────────

interface ParsedChunk {
  chunk_index: number;
  content: string;
  token_count: number;
  page_number: number | null;
  section_heading: string | null;
  chunk_type: string;
  metadata: Record<string, unknown>;
}

interface ParseResponse {
  doc_id: string;
  page_count: number;
  language: string;
  chunks: ParsedChunk[];
}

// ─── Sidecar Communication ───────────────────────────────

/**
 * Send a document to the Python sidecar for parsing & chunking.
 */
async function callSidecar(
  fileUrl: string,
  docType: string,
  docId: string
): Promise<ParseResponse> {
  console.log(
    `[Pipeline] Calling sidecar for doc ${docId} (type: ${docType})`
  );

  const response = await fetch(`${SIDECAR_URL}/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_url: fileUrl,
      doc_type: docType,
      doc_id: docId,
      options: {
        ocr_fallback: true,
        language: "en",
        chunk_config: {
          target_tokens: 500,
          min_tokens: 300,
          max_tokens: 800,
          overlap_tokens: 100,
        },
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sidecar parse failed (${response.status}): ${text}`);
  }

  return response.json();
}

// ─── Single Document Processing ──────────────────────────

/**
 * Process a single document through the full pipeline:
 * 1. Call sidecar to parse + chunk
 * 2. Generate embeddings for all chunks
 * 3. Upsert vectors to Pinecone
 * 4. Save chunks to DB
 * 5. Update document status
 */
export async function processDocument(docId: string): Promise<void> {
  // Fetch document record
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1);

  if (!doc) {
    throw new Error(`Document ${docId} not found`);
  }

  try {
    // ── Step 1: Parse with sidecar ──
    await db
      .update(documents)
      .set({ status: "parsing", updatedAt: new Date() })
      .where(eq(documents.id, docId));

    const parsed = await callSidecar(
      doc.storageUrl || doc.storagePath || "",
      doc.docType,
      docId
    );

    // Update page count and language from parser
    await db
      .update(documents)
      .set({
        status: "chunking",
        pageCount: parsed.page_count,
        language: parsed.language,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docId));

    if (parsed.chunks.length === 0) {
      await db
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(documents.id, docId));
      console.log(`[Pipeline] Doc ${docId}: No chunks extracted, marking ready`);
      return;
    }

    // ── Step 2: Generate embeddings ──
    await db
      .update(documents)
      .set({ status: "embedding", updatedAt: new Date() })
      .where(eq(documents.id, docId));

    const chunkTexts = parsed.chunks.map((c) => c.content);
    const embeddingResults = await generateEmbeddings(chunkTexts);

    // ── Step 3: Build Pinecone vectors ──
    const vectors: UpsertVector[] = parsed.chunks.map((chunk, idx) => {
      const pineconeId = `${docId}_chunk_${chunk.chunk_index}`;
      const embedding = embeddingResults.find((e) => e.index === idx);

      const metadata: VectorMetadata = {
        doc_id: docId,
        vault_id: doc.vaultId,
        tenant_id: doc.tenantId,
        file_name: doc.fileName,
        doc_type: doc.docType,
        source: "upload",
        upload_time: doc.uploadTime.toISOString(),
        page_number: chunk.page_number || 0,
        section_heading: chunk.section_heading || "",
        chunk_index: chunk.chunk_index,
        chunk_type: chunk.chunk_type,
        language: parsed.language || "en",
        token_count: chunk.token_count,
        checksum: doc.checksum,
      };

      return {
        id: pineconeId,
        values: embedding?.embedding || [],
        metadata,
      };
    });

    // Filter out any vectors that don't have embeddings
    const validVectors = vectors.filter((v) => v.values.length > 0);
    if (validVectors.length > 0) {
      await upsertVectors(validVectors);
    }

    // ── Step 4: Save chunks to DB ──
    const chunkRows = parsed.chunks.map((chunk, idx) => ({
      documentId: docId,
      vaultId: doc.vaultId,
      tenantId: doc.tenantId,
      chunkIndex: chunk.chunk_index,
      content: chunk.content,
      tokenCount: chunk.token_count,
      pageNumber: chunk.page_number,
      sectionHeading: chunk.section_heading,
      chunkType: chunk.chunk_type as any,
      pineconeId: `${docId}_chunk_${chunk.chunk_index}`,
      embeddingModel: EMBEDDING_MODEL,
    }));

    // Insert in batches of 100
    for (let i = 0; i < chunkRows.length; i += 100) {
      const batch = chunkRows.slice(i, i + 100);
      await db.insert(documentChunks).values(batch);
    }

    // ── Step 5: Mark document as ready ──
    await db
      .update(documents)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(documents.id, docId));

    console.log(
      `[Pipeline] Doc ${docId}: Processed ${parsed.chunks.length} chunks, ${validVectors.length} vectors upserted`
    );
  } catch (error: any) {
    console.error(`[Pipeline] Doc ${docId} failed:`, error.message);
    await db
      .update(documents)
      .set({
        status: "failed",
        errorMessage: error.message?.substring(0, 1000),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, docId));
    throw error;
  }
}

// ─── Ingestion Job Processing ────────────────────────────

/**
 * Process all documents in an ingestion job.
 */
export async function processIngestionJob(jobId: string): Promise<void> {
  const [job] = await db
    .select()
    .from(ingestionJobs)
    .where(eq(ingestionJobs.id, jobId))
    .limit(1);

  if (!job) throw new Error(`Job ${jobId} not found`);

  await db
    .update(ingestionJobs)
    .set({ status: "parsing", startedAt: new Date() })
    .where(eq(ingestionJobs.id, jobId));

  // Get all pending documents for this vault from this job creation time
  const pendingDocs = await db
    .select()
    .from(documents)
    .where(
      and(eq(documents.vaultId, job.vaultId), eq(documents.status, "pending"))
    );

  let processed = 0;
  let failed = 0;
  const errorLog: Array<{ docId: string; error: string }> = [];

  for (const doc of pendingDocs) {
    try {
      await processDocumentFull(doc.id);
      processed++;
    } catch (error: any) {
      failed++;
      errorLog.push({ docId: doc.id, error: error.message });
    }

    // Update progress
    await db
      .update(ingestionJobs)
      .set({
        processedFiles: processed,
        failedFiles: failed,
        errorLog: errorLog.length > 0 ? errorLog : undefined,
      })
      .where(eq(ingestionJobs.id, jobId));
  }

  // Mark job complete
  await db
    .update(ingestionJobs)
    .set({
      status: failed === pendingDocs.length ? "failed" : "completed",
      completedAt: new Date(),
      processedFiles: processed,
      failedFiles: failed,
      errorLog: errorLog.length > 0 ? errorLog : undefined,
    })
    .where(eq(ingestionJobs.id, jobId));

  console.log(
    `[Pipeline] Job ${jobId}: Completed. ${processed} processed, ${failed} failed out of ${pendingDocs.length}`
  );
}

// ─── Analysis Pipeline ───────────────────────────────────

const nvidia = new OpenAI({
  apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const ANALYSIS_MODEL = "moonshotai/kimi-k2-instruct";

/**
 * Run a full analysis on a document: summary, section summaries, key entities.
 */
export async function runDocumentAnalysis(docId: string): Promise<void> {
  // Create the analysis job
  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, docId))
    .limit(1);

  if (!doc) throw new Error(`Document ${docId} not found`);

  // Check if a full_analysis job already exists and is completed
  const existingJobs = await db
    .select()
    .from(analysisJobs)
    .where(
      and(
        eq(analysisJobs.documentId, docId),
        eq(analysisJobs.jobType, "full_analysis")
      )
    );

  const existingCompleted = existingJobs.find(
    (j) => j.status === "completed"
  );
  if (existingCompleted) {
    console.log(
      `[Analysis] Doc ${docId}: Already analyzed, skipping`
    );
    return;
  }

  // Create or find existing queued job
  let analysisJobId: string;
  const existingQueued = existingJobs.find((j) => j.status === "queued");
  if (existingQueued) {
    analysisJobId = existingQueued.id;
  } else {
    const [newJob] = await db
      .insert(analysisJobs)
      .values({
        documentId: docId,
        vaultId: doc.vaultId,
        tenantId: doc.tenantId,
        jobType: "full_analysis",
      })
      .returning();
    analysisJobId = newJob.id;
  }

  try {
    await db
      .update(analysisJobs)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(analysisJobs.id, analysisJobId));

    // Update document status
    await db
      .update(documents)
      .set({ status: "analyzing", updatedAt: new Date() })
      .where(eq(documents.id, docId));

    // Fetch all chunks for the document
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, docId));

    if (chunks.length === 0) {
      throw new Error("No chunks found for analysis");
    }

    // Build a condensed version of the document content
    // (max ~50000 chars to stay within context window)
    const sortedChunks = chunks.sort(
      (a, b) => a.chunkIndex - b.chunkIndex
    );
    let combinedContent = "";
    for (const chunk of sortedChunks) {
      const header = chunk.sectionHeading
        ? `\n### ${chunk.sectionHeading}\n`
        : "";
      combinedContent += `${header}${chunk.content}\n\n`;
      if (combinedContent.length > 50000) {
        combinedContent += "\n[CONTENT TRUNCATED FOR LENGTH]";
        break;
      }
    }

    // ── Generate analysis via LLM ──
    const analysisPrompt = `Analyze this legal document and produce a comprehensive analysis.

DOCUMENT: ${doc.fileName}
TYPE: ${doc.docType}

CONTENT:
${combinedContent}

Return ONLY a JSON object with this exact structure:
{
  "doc_summary": {
    "summary": "A 2-3 paragraph comprehensive summary of the document",
    "key_themes": ["theme1", "theme2", "..."],
    "document_purpose": "What this document is about and its legal significance"
  },
  "section_summaries": [
    {
      "heading": "Section/Chapter heading",
      "summary": "1-2 sentence summary",
      "key_points": ["point1", "point2"]
    }
  ],
  "key_entities": {
    "statutes": ["statute references"],
    "sections": ["section references"],
    "persons": ["person names"],
    "courts": ["court names"],
    "dates": ["relevant dates"],
    "legal_concepts": ["key legal concepts"],
    "organizations": ["org names"]
  }
}

JSON:`;

    const stream = await nvidia.chat.completions.create({
      model: ANALYSIS_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a legal document analyst. Analyze the document and return ONLY valid JSON. Do not include markdown code fences.",
        },
        { role: "user", content: analysisPrompt },
      ],
      stream: true,
      max_tokens: 16384,
    } as any);

    let fullContent = "";
    for await (const chunk of stream as any) {
      const delta = (chunk as any).choices?.[0]?.delta as any;
      if (delta?.content) {
        fullContent += delta.content;
      }
    }

    // Parse the result  
    let analysisResult: Record<string, unknown>;
    try {
      // Clean up the response
      let clean = fullContent.trim();
      if (clean.includes("```")) {
        const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) clean = match[1].trim();
      }
      const firstBrace = clean.indexOf("{");
      const lastBrace = clean.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1) {
        clean = clean.substring(firstBrace, lastBrace + 1);
      }
      analysisResult = JSON.parse(clean);
    } catch (e) {
      // If JSON parsing fails, store the raw text
      analysisResult = {
        doc_summary: {
          summary: fullContent,
          key_themes: [],
          document_purpose: "Analysis parsing failed - raw output stored",
        },
        section_summaries: [],
        key_entities: {},
        _raw: fullContent,
        _parse_error: true,
      };
    }

    // Save analysis results
    await db
      .update(analysisJobs)
      .set({
        status: "completed",
        result: analysisResult,
        completedAt: new Date(),
      })
      .where(eq(analysisJobs.id, analysisJobId));

    // Also embed and store the overarching analysis as a vector chunk
    try {
      const docSummaryObj = analysisResult.doc_summary as Record<string, any>;
      const keyEntitiesObj = analysisResult.key_entities as Record<string, any>;

      const docSummaryStr = docSummaryObj ?
        `Document Summary: ${docSummaryObj.summary}\nThemes: ${(docSummaryObj.key_themes || []).join(', ')}\nPurpose: ${docSummaryObj.document_purpose}` : "";

      const keyEntitiesStr = keyEntitiesObj ?
        `Key Entities: ${JSON.stringify(keyEntitiesObj)}` : "";

      const analysisContent = `[GLOBAL DOCUMENT ANALYSIS]\n${docSummaryStr}\n\n${keyEntitiesStr}`;

      if (docSummaryStr.trim() || keyEntitiesStr.trim()) {
        const summaryEmbeddings = await generateEmbeddings([analysisContent]);

        if (summaryEmbeddings[0] && summaryEmbeddings[0].embedding.length > 0) {
          const chunkIndex = 9999;
          const pineconeId = `${docId}_chunk_analysis`;

          await upsertVectors([{
            id: pineconeId,
            values: summaryEmbeddings[0].embedding,
            metadata: {
              doc_id: docId,
              vault_id: doc.vaultId,
              tenant_id: doc.tenantId,
              file_name: doc.fileName,
              doc_type: doc.docType,
              source: "analysis",
              upload_time: doc.uploadTime.toISOString(),
              page_number: 0,
              section_heading: "Global Document Analysis",
              chunk_index: chunkIndex,
              chunk_type: "document_summary",
              language: doc.language || "en",
              token_count: Math.floor(analysisContent.length / 4),
              checksum: doc.checksum,
            }
          }]);

          await db.insert(documentChunks).values({
            documentId: docId,
            vaultId: doc.vaultId,
            tenantId: doc.tenantId,
            chunkIndex: chunkIndex,
            content: analysisContent,
            tokenCount: Math.floor(analysisContent.length / 4),
            pageNumber: 0,
            sectionHeading: "Global Document Analysis",
            chunkType: "text",
            pineconeId: pineconeId,
            embeddingModel: EMBEDDING_MODEL,
          });
          console.log(`[Analysis] Doc ${docId}: Embedded analysis into Pinecone`);
        }
      }
    } catch (embErr: any) {
      console.error(`[Analysis] Doc ${docId}: Failed to embed analysis:`, embErr.message);
    }

    // Update document status back to ready
    await db
      .update(documents)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(documents.id, docId));

    console.log(`[Analysis] Doc ${docId}: Analysis completed successfully`);
  } catch (error: any) {
    console.error(`[Analysis] Doc ${docId} failed:`, error.message);

    await db
      .update(analysisJobs)
      .set({
        status: "failed",
        result: { error: error.message },
        completedAt: new Date(),
      })
      .where(eq(analysisJobs.id, analysisJobId));

    // Don't change doc status if it was already ready (analysis is optional)
    const [currentDoc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);

    if (currentDoc?.status === "analyzing") {
      await db
        .update(documents)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(documents.id, docId));
    } 
  }
}

/**
 * Full pipeline: process document + auto-trigger analysis.
 * This is the function called when a document is uploaded.
 */
export async function processDocumentFull(docId: string): Promise<void> {
  // Step 1: Ingestion pipeline (parse → chunk → embed → store)
  await processDocument(docId);

  // Step 2: Auto-trigger analysis (summary, entities, etc.)
  // Run as fire-and-forget — don't block the ingestion response
  runDocumentAnalysis(docId).catch((err) => {
    console.error(
      `[Pipeline] Auto-analysis failed for doc ${docId}:`,
      err.message
    );
  });
}
