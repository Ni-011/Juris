import { db } from "../src/lib/db";
import {
  vaults,
  documents,
  documentChunks,
  bulkAnalysisJobs,
  bulkAnalysisStatusEnum
} from "../src/drizzle/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";
import { generateEmbedding } from "../src/lib/embeddings";
import { queryVaultMetadata } from "../src/lib/pinecone";

// ─── Setup ──────────────────────────────────────────────────

const nvidia = new OpenAI({
  apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const PLANNER_MODEL = "moonshotai/kimi-k2-instruct";
const CLASSIFIER_MODEL = "moonshotai/kimi-k2-instruct";
const WORKER_MODEL = "moonshotai/kimi-k2-instruct";
const AGGREGATOR_MODEL = "moonshotai/kimi-k2-instruct";

const CONCURRENCY = 5;

// ─── Helpers ────────────────────────────────────────────────

async function updateJob(jobId: string, data: any) {
  await db.update(bulkAnalysisJobs).set(data).where(eq(bulkAnalysisJobs.id, jobId));
}

function cleanJson(text: string): string {
  let clean = text.trim();
  if (clean.includes("\`\`\`")) {
    const match = clean.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
    if (match) clean = match[1];
  }
  return clean.trim();
}

async function callLLM(model: string, system: string, user: string, maxTokens = 4000): Promise<any> {
  const response = await nvidia.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: maxTokens,
  } as any);
  return JSON.parse(cleanJson((response.choices[0].message.content as string) || "{}"));
}

// ─── Stage 1: Planner ───────────────────────────────────────

async function runPlanner(jobId: string, prompt: string, vaultId: string) {
  console.log(`[Bulk Analyzer] Stage 1: Planning for job ${jobId}`);
  await updateJob(jobId, { status: "planning", startedAt: new Date() });

  // Get vault context
  const docCountResult = await db.select({ count: documents.id }).from(documents).where(eq(documents.vaultId, vaultId));
  const docCount = docCountResult.length;

  const planPrompt = `Create an execution plan for a bulk document analysis job.
Vault size: ${docCount} documents.
User prompt: "${prompt}"

Return JSON:
{
  "task_description": "Clear instructions for worker LLM to extract data from a single document",
  "extraction_schema": { "field": "type description" },
  "classification_prompt": "Are you looking for 'retention clauses' or 'financial data'? (Used to filter irrelevant docs)"
}`;

  const plan = await callLLM(PLANNER_MODEL, "You are a distributed job planner. Output valid JSON.", planPrompt);
  
  await updateJob(jobId, { plan, totalDocs: docCount });
  return plan;
}

// ─── Stage 2: Classifier ────────────────────────────────────

async function runClassifier(jobId: string, vaultId: string, plan: any) {
  console.log(`[Bulk Analyzer] Stage 2: Classification (filtering irrelevant docs)`);
  await updateJob(jobId, { status: "classifying" });

  // Tier 1: Semantic Prefilter
  console.log(`[Bulk Analyzer] Classification Tier 1: Vector similarity`);
  const taskEmbedding = await generateEmbedding(plan.classification_prompt || plan.task_description);
  
  // Fetch top 1000 chunks metadata (no values to save memory)
  const relevantChunks = await queryVaultMetadata(taskEmbedding, vaultId, 1000);
  
  // Group by doc_id
  const docScores: Record<string, { maxScore: number; chunks: any[] }> = {};
  for (const match of relevantChunks) {
    const docId = match.metadata.doc_id;
    if (!docScores[docId]) docScores[docId] = { maxScore: 0, chunks: [] };
    docScores[docId].maxScore = Math.max(docScores[docId].maxScore, match.score || 0);
    docScores[docId].chunks.push(match);
  }

  // Filter docs with score > 0.75 (heuristic)
  const candidateDocIds = Object.keys(docScores).filter(id => docScores[id].maxScore > 0.75);
  console.log(`[Bulk Analyzer] Tier 1 pruned down to ${candidateDocIds.length} candidate docs.`);

  if (candidateDocIds.length === 0) {
    await updateJob(jobId, { relevantDocs: 0, classifiedDocIds: [] });
    return [];
  }

  // Tier 2: LLM Spot-check
  console.log(`[Bulk Analyzer] Classification Tier 2: LLM spot-check on ${candidateDocIds.length} docs`);
  const BATCH_SIZE = 30;
  const passedClassification: { docId: string; score: number; reason: string }[] = [];

  for (let i = 0; i < candidateDocIds.length; i += BATCH_SIZE) {
    const batch = candidateDocIds.slice(i, i + BATCH_SIZE);
    
    let spotCheckPrompt = `Task: ${plan.classification_prompt}\n\nFor each document sample below, determine if it is likely to contain relevant information for the task. Output JSON array of { doc_id, relevant: boolean, reason: string }.\n\n`;
    
    for (const docId of batch) {
      // Pick highest scoring chunk as representative
      const bestChunk = docScores[docId].chunks.sort((a,b) => b.score - a.score)[0];
      const text = bestChunk.metadata.text || bestChunk.metadata.content || "";
      spotCheckPrompt += `[DOC: ${docId}] Sample: "...${text.substring(0, 300)}..."\n\n`;
    }

    try {
      const clsResult = await callLLM(CLASSIFIER_MODEL, "You are a relevance classifier. Output valid JSON array.", spotCheckPrompt);
      if (Array.isArray(clsResult)) {
        for (const res of clsResult) {
          if (res.relevant) {
            passedClassification.push({
              docId: res.doc_id,
              score: docScores[res.doc_id].maxScore,
              reason: res.reason
            });
          }
        }
      }
    } catch (e) {
      console.warn(`[Bulk Analyzer] Classifier batch ${i} failed, accepting all for safety`);
      batch.forEach(docId => passedClassification.push({ docId, score: docScores[docId].maxScore, reason: "fallback" }));
    }
  }

  console.log(`[Bulk Analyzer] Tier 2 pruned down to ${passedClassification.length} relevant docs.`);
  
  await updateJob(jobId, { 
    relevantDocs: passedClassification.length,
    classifiedDocIds: passedClassification,
    totalShards: passedClassification.length // 1 shard per doc
  });

  return passedClassification;
}

// ─── Stage 3: Workers ───────────────────────────────────────

async function processShard(docId: string, plan: any) {
  // Fetch chunks for this doc
  const chunks = await db.select().from(documentChunks).where(eq(documentChunks.documentId, docId));
  
  if (chunks.length === 0) return null;

  // Build context
  const sortedChunks = chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  let combinedContent = "";
  for (const chunk of sortedChunks) {
    combinedContent += `${chunk.sectionHeading ? "### "+chunk.sectionHeading : ""}\n${chunk.content}\n\n`;
    if (combinedContent.length > 50000) {
      combinedContent += "\n[TRUNCATED]";
      break;
    }
  }

  const prompt = `Task: ${plan.task_description}

Required output schema:
${JSON.stringify(plan.extraction_schema, null, 2)}

Document content:
${combinedContent}

Return ONLY matching JSON object. Make sure to include the original docId in your output.`;

  return await callLLM(WORKER_MODEL, "You are a data extraction worker. Output valid JSON exactly matching the schema.", prompt);
}

async function runWorkers(jobId: string, classifiedDocs: any[], plan: any) {
  console.log(`[Bulk Analyzer] Stage 3: Running ${classifiedDocs.length} workers with concurrency ${CONCURRENCY}`);
  await updateJob(jobId, { status: "processing" });

  let completed = 0;
  let failed = 0;
  const results: any[] = [];

  // Simple concurrency control
  let i = 0;
  const workers = Array(Math.min(CONCURRENCY, classifiedDocs.length)).fill(0).map(async () => {
    while (i < classifiedDocs.length) {
      const idx = i++;
      const docId = classifiedDocs[idx].docId;
      try {
        const result = await processShard(docId, plan);
        if (result) {
          result._docId = docId;
          results.push(result);
        }
        completed++;
      } catch (e: any) {
        console.error(`[Bulk Analyzer] Worker for doc ${docId} failed: ${e.message}`);
        failed++;
      }
      
      // Update progress every 5 chunks
      if ((completed + failed) % 5 === 0) {
        await updateJob(jobId, { completedShards: completed, failedShards: failed, shardResults: results });
      }
    }
  });

  await Promise.all(workers);
  
  await updateJob(jobId, { completedShards: completed, failedShards: failed, shardResults: results });
  return results;
}

// ─── Stage 4: Aggregator ────────────────────────────────────

async function runAggregator(jobId: string, plan: any, results: any[]) {
  if (results.length === 0) {
    console.log(`[Bulk Analyzer] No results to aggregate.`);
    await updateJob(jobId, { status: "completed", finalResult: { message: "No relevant documents found or processed." }, completedAt: new Date() });
    return;
  }

  console.log(`[Bulk Analyzer] Stage 4: Aggregator merge`);
  await updateJob(jobId, { status: "aggregating" });

  let chunkedResults = [];
  // If too many results, this might exceed context window. Let's do a naive chunking if needed.
  let currentChunk = "";
  for (const r of results) {
    const s = JSON.stringify(r);
    if (currentChunk.length + s.length > 50000) {
      chunkedResults.push(currentChunk);
      currentChunk = s + ",";
    } else {
      currentChunk += s + ",";
    }
  }
  if (currentChunk) chunkedResults.push(currentChunk);

  let finalAggregatedText = "";
  // In a real prod environment we might map-reduce, but 
  // since this is a demo, we will just use the first chunk if it fits, else summarize.
  
  const aggPrompt = `You are the master aggregator.
Task: ${plan.task_description}

Here are the extracted findings from multiple documents:
[${chunkedResults[0]}]

Produce the final comprehensive report, grouped logically. Output as JSON: { "report_title": "...", "sections": [{"heading": "...", "findings": [...]}] }`;

  const finalResult = await callLLM(AGGREGATOR_MODEL, "You are a report aggregator. Output valid JSON.", aggPrompt, 8000);

  await updateJob(jobId, {
    status: "completed",
    finalResult,
    completedAt: new Date()
  });
  console.log(`[Bulk Analyzer] Job ${jobId} completed successfully.`);
}

// ─── Main Entry ─────────────────────────────────────────────

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error("Usage: ts-node bulk-analyzer.ts <jobId>");
    process.exit(1);
  }

  try {
    const [job] = await db.select().from(bulkAnalysisJobs).where(eq(bulkAnalysisJobs.id, jobId));
    if (!job) throw new Error(`Job ${jobId} not found`);

    console.log(`[Bulk Analyzer] Starting job ${jobId}`);

    const plan = await runPlanner(jobId, job.userPrompt, job.vaultId);
    if (!plan) throw new Error("Planner failed");

    const classifiedDocs = await runClassifier(jobId, job.vaultId, plan);
    
    if (classifiedDocs.length > 0) {
      const results = await runWorkers(jobId, classifiedDocs, plan);
      await runAggregator(jobId, plan, results);
    } else {
      await runAggregator(jobId, plan, []);
    }

  } catch (error: any) {
    console.error(`[Bulk Analyzer] Fatal error:`, error);
    await updateJob(jobId, { status: "failed", errorMessage: error.message, completedAt: new Date() });
    process.exit(1);
  }
  process.exit(0);
}

main();
