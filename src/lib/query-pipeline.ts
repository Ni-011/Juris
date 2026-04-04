import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { queryVectors } from "./pinecone";
import { rerankChunks } from "./reranker";

// ─── Setup ──────────────────────────────────────────────────

const nvidia = new OpenAI({
  apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const INTENT_MODEL = "moonshotai/kimi-k2-instruct";
const COMPILE_MODEL = "moonshotai/kimi-k2-instruct";

// ─── Types ──────────────────────────────────────────────────

export interface QueryIntent {
  query_type: "search" | "compare" | "summarize" | "extract" | "general_chat";
  search_query: string;
  metadata_filters: {
    doc_types?: string[];
    file_names?: string[];
  };
  scope: "single_doc" | "multi_doc" | "full_vault";
  top_k: number;
}

export interface BalancedChunk {
  id: string;
  doc_id: string;
  file_name: string;
  page_number: number;
  section_heading: string;
  content: string;
  score: number;
}

// ─── Stage 1: Intent Parsing ────────────────────────────────

export async function parseIntent(
  userQuery: string,
  availableDocs: { id: string; fileName: string; docType: string }[]
): Promise<QueryIntent> {
  const docList = availableDocs
    .map((d) => `- ${d.fileName} (Type: ${d.docType})`)
    .join("\n");

  const prompt = `Analyze this user query for a legal vault containing these documents:
${docList}

Query: "${userQuery}"

Return ONLY a JSON object with this shape:
{
  "query_type": "search" | "compare" | "summarize" | "extract" | "general_chat",
  "search_query": "Optimized query string for vector similarity search",
  "metadata_filters": {
    "doc_types": [], // e.g. ["pdf", "docx"] if specified
    "file_names": [] // matching exact file names if user mentioned specific docs
  },
  "scope": "single_doc" | "multi_doc" | "full_vault",
  "top_k": number // 5 for highly precise, 15 for narrative, 30 for comparative/broad
}`;

  console.log(`[Query Pipeline] Stage 1: Parsing Intent...`);
  const response = await nvidia.chat.completions.create({
    model: INTENT_MODEL,
    messages: [
      {
        role: "system",
        content: "You are a query intent router. Output ONLY valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 1000,
  } as any);

  try {
    let content = (response.choices[0].message.content as string) || "";
    // Clean markdown
    if (content.includes("\`\`\`")) {
      const match = content.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
      if (match) content = match[1];
    }
    const result = JSON.parse(content.trim()) as QueryIntent;
    
    // Ensure top_k is reasonable
    result.top_k = Math.max(3, Math.min(result.top_k || 15, 50));
    console.log(`[Query Pipeline] Intent parsed:`, result);
    return result;
  } catch (e) {
    console.error(`[Query Pipeline] Intent parsing failed, using default fallback.`);
    return {
      query_type: "search",
      search_query: userQuery,
      metadata_filters: {},
      scope: "full_vault",
      top_k: 15,
    };
  }
}

// ─── Stage 2: Filter Builder ────────────────────────────────

export function buildFilters(vaultId: string, intent: QueryIntent) {
  const filters: Record<string, any> = { vault_id: { $eq: vaultId } };

  if (intent.metadata_filters.file_names?.length) {
    filters.file_name = { $in: intent.metadata_filters.file_names };
  }
  if (intent.metadata_filters.doc_types?.length) {
    filters.doc_type = { $in: intent.metadata_filters.doc_types };
  }

  return filters;
}

// ─── Stage 3 & 4: Retrieve & Rerank ─────────────────────────

export async function retrieveAndRerank(
  intent: QueryIntent,
  filters: Record<string, any>
): Promise<BalancedChunk[]> {
  console.log(`[Query Pipeline] Stage 3: Vector Retrieval...`);
  // Over-fetch by 3x for reranker
  const fetchCount = intent.top_k * 3;
  
  const embedding = await generateEmbedding(intent.search_query);
  const pineconeMatches = await queryVectors(embedding, fetchCount, filters);

  if (!pineconeMatches.length) return [];

  // Map to format for reranker
  const docsToRerank = pineconeMatches.map((m) => ({
    id: m.id,
    content: (m.metadata?.text as string) || (m.metadata?.chunk_text as string) || (m.metadata?.content as string) || "",
    metadata: m.metadata || {},
  }));

  console.log(`[Query Pipeline] Stage 4: Reranking ${docsToRerank.length} chunks...`);
  const ranked = await rerankChunks(intent.search_query, docsToRerank, intent.top_k * 2);

  // Map back to BalancedChunk shape
  return ranked.map((r) => ({
    id: r.id,
    doc_id: r.metadata.doc_id,
    file_name: r.metadata.file_name,
    page_number: Number(r.metadata.page_number) || 0,
    section_heading: r.metadata.section_heading || "",
    content: r.content,
    score: r.score,
  }));
}

// ─── Stage 5: Evidence Balancer ─────────────────────────────

export function balanceEvidence(
  chunks: BalancedChunk[],
  intent: QueryIntent
): BalancedChunk[] {
  console.log(`[Query Pipeline] Stage 5: Balancing Evidence...`);
  
  // 1. Group by doc_id
  const byDoc = chunks.reduce((acc, chunk) => {
    if (!acc[chunk.doc_id]) acc[chunk.doc_id] = [];
    acc[chunk.doc_id].push(chunk);
    return acc;
  }, {} as Record<string, BalancedChunk[]>);

  // 2. Score docs by their highest ranking chunk
  const docScores = Object.entries(byDoc).map(([doc_id, group]) => {
    return {
      doc_id,
      maxScore: Math.max(...group.map(c => c.score)),
      chunks: group
    };
  });

  // Sort docs desc
  docScores.sort((a, b) => b.maxScore - a.maxScore);

  // 3. Selection rules based on intent
  const MAX_DOCS = intent.query_type === "compare" ? Math.max(docScores.length, 10) : 5;
  const MAX_CHUNKS_PER_DOC = intent.query_type === "summarize" ? 10 : 3;

  const selectedDocs = docScores.slice(0, MAX_DOCS);
  
  const finalChunks: BalancedChunk[] = [];
  
  for (const doc of selectedDocs) {
    // Sort chunks within doc by score
    doc.chunks.sort((a, b) => b.score - a.score);
    
    // Simple diversity check (prefer different pages if possible)
    const pickedPages = new Set<number>();
    let acceptedForDoc = 0;
    
    for (const chunk of doc.chunks) {
      if (acceptedForDoc >= MAX_CHUNKS_PER_DOC) break;
      
      // Allow if page not picked yet, or if we strictly need more chunks
      if (!pickedPages.has(chunk.page_number) || acceptedForDoc < 2) {
        finalChunks.push(chunk);
        pickedPages.add(chunk.page_number);
        acceptedForDoc++;
      }
    }
  }

  // Sort final set by overall relevance score again
  finalChunks.sort((a, b) => b.score - a.score);
  
  console.log(`[Query Pipeline] Balanced from ${chunks.length} → ${finalChunks.length} chunks across ${selectedDocs.length} docs`);
  return finalChunks;
}

// ─── Stage 6: Compiler (Generates Stream) ───────────────────

export async function compileResponseStream(
  originalMessages: { role: string; content: string }[],
  evidence: BalancedChunk[]
): Promise<ReadableStream> {
  console.log(`[Query Pipeline] Stage 6: Compiling LLM Response...`);

  // Build context block
  let contextBlock = "NO EVIDENCE FOUND.";
  if (evidence.length > 0) {
    contextBlock = evidence
      .map((c, i) => {
        return `[${i + 1}] SOURCE: ${c.file_name}
PAGE: ${c.page_number}
SECTION: ${c.section_heading}
---
${c.content}
---`;
      })
      .join("\n\n");
  }

  const systemPrompt = `You are Juris, an elite legal AI assistant analyzing a vault of documents.

EVIDENCE PROVIDED:
==================
${contextBlock}
==================

INSTRUCTIONS:
1. Answer the user's latest query using ONLY the evidence provided above.
2. If the user asks a conversational follow-up, use the chat history to understand the context, but still anchor facts in the evidence.
3. CITATIONS ARE MANDATORY. Every factual claim MUST end with a citation to the source index like [[1]] or [[2,4]].
4. If the evidence does NOT contain the answer, explicitly state that you cannot find the answer in the provided documents. Do not guess or hallucinate.
5. Format your response cleanly with markdown. Use bullet points or numbered lists for readability.`;

  // We only keep the last few messages to save tokens, but inject system prompt
  const recentMessages = originalMessages.slice(-5).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content
  }));

  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      const sendChunk = (data: any) => {
        if (streamClosed) return;
        try {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(data) + "\\n"));
        } catch (e) {}
      };
      const closeStream = () => {
        if (streamClosed) return;
        streamClosed = true;
        try { controller.close(); } catch (e) {}
      };

      try {
        const responseStream = await nvidia.chat.completions.create({
          model: COMPILE_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            ...recentMessages
          ],
          stream: true,
          max_tokens: 4096,
        } as any);

        for await (const chunk of responseStream as any) {
          const delta = (chunk as any).choices?.[0]?.delta;
          if (delta?.content) {
            sendChunk({ t: delta.content });
          }
        }

        // Send metadata payload at the end for the UI
        sendChunk({ 
          m: { 
            citations: evidence.map((c, i) => ({
              id: `${i+1}`,
              fileName: c.file_name,
              pageNumber: c.page_number,
              sectionHeading: c.section_heading
            }))
          } 
        });

        closeStream();
      } catch (error: any) {
        console.error("[Query Pipeline] Compilation failed:", error);
        sendChunk({ t: "\\n\\n⚠️ An error occurred while generating the response." });
        closeStream();
      }
    }
  });

  return stream;
}
