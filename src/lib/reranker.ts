import OpenAI from "openai";

/**
 * Reranker Abstraction Layer
 * Currently uses NVIDIA NIM nv-rerankqa-mistral-4b-v3.
 * Designed for easy swapping — just implement the RerankerProvider interface.
 */

// ─── Abstraction ─────────────────────────────────────────

export interface RankedChunk {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, any>;
}

interface RerankerProvider {
  name: string;
  rerank(
    query: string,
    documents: { id: string; content: string; metadata: Record<string, any> }[],
    topK: number
  ): Promise<RankedChunk[]>;
}

// ─── NVIDIA NIM Reranker ─────────────────────────────────

const nvidia = new OpenAI({
  apiKey: (process.env.NVIDIA || process.env.NVIDEA) as string,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const RERANK_MODEL = "nvidia/rerank-qa-mistral-4b";

class NvidiaReranker implements RerankerProvider {
  name = "nvidia-nim";

  async rerank(
    query: string,
    documents: { id: string; content: string; metadata: Record<string, any> }[],
    topK: number
  ): Promise<RankedChunk[]> {
    if (documents.length === 0) return [];

    // NVIDIA reranker expects passages as strings
    // Batch in groups of 100 to stay within limits
    const BATCH = 100;
    const allScored: { idx: number; score: number }[] = [];

    for (let i = 0; i < documents.length; i += BATCH) {
      const batch = documents.slice(i, i + BATCH);
      const passages = batch.map((d) => d.content);

      try {
        // NVIDIA NIM reranker uses the same OpenAI-compatible API
        // but through a special endpoint pattern
        const response = await fetch(
          "https://ai.api.nvidia.com/v1/retrieval/nvidia/reranking",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.NVIDIA || process.env.NVIDEA}`,
            },
            body: JSON.stringify({
              model: RERANK_MODEL,
              query: { text: query },
              passages: passages.map((p) => ({ text: p })),
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.error(`[Reranker] NVIDIA API error (${response.status}): ${errText.substring(0, 200)}`);
          // Fallback: return original order with linear scores
          batch.forEach((_, j) => {
            allScored.push({ idx: i + j, score: 1 - (i + j) / documents.length });
          });
          continue;
        }

        const data = await response.json();
        const rankings = data.rankings || [];

        for (const r of rankings) {
          allScored.push({
            idx: i + r.index,
            score: r.logit ?? r.score ?? 0,
          });
        }
      } catch (error: any) {
        console.error(`[Reranker] Batch ${i} failed: ${error.message}`);
        batch.forEach((_, j) => {
          allScored.push({ idx: i + j, score: 1 - (i + j) / documents.length });
        });
      }
    }

    // Sort by score descending, take topK
    allScored.sort((a, b) => b.score - a.score);
    const topResults = allScored.slice(0, topK);

    return topResults.map((r) => ({
      id: documents[r.idx].id,
      score: r.score,
      content: documents[r.idx].content,
      metadata: documents[r.idx].metadata,
    }));
  }
}

// ─── Fallback: Passthrough (no reranking) ────────────────

class PassthroughReranker implements RerankerProvider {
  name = "passthrough";

  async rerank(
    _query: string,
    documents: { id: string; content: string; metadata: Record<string, any> }[],
    topK: number
  ): Promise<RankedChunk[]> {
    return documents.slice(0, topK).map((d, i) => ({
      id: d.id,
      score: 1 - i / documents.length,
      content: d.content,
      metadata: d.metadata,
    }));
  }
}

// ─── Factory ─────────────────────────────────────────────

const providers: Record<string, RerankerProvider> = {
  "nvidia-nim": new NvidiaReranker(),
  passthrough: new PassthroughReranker(),
};

// Switch by env var or default to nvidia
const ACTIVE_PROVIDER = process.env.RERANKER_PROVIDER || "nvidia-nim";

export function getReranker(): RerankerProvider {
  return providers[ACTIVE_PROVIDER] || providers["nvidia-nim"];
}

/**
 * Rerank documents against a query using the active provider.
 */
export async function rerankChunks(
  query: string,
  documents: { id: string; content: string; metadata: Record<string, any> }[],
  topK: number = 15
): Promise<RankedChunk[]> {
  const reranker = getReranker();
  console.log(`[Reranker] Using ${reranker.name}, ${documents.length} docs → top ${topK}`);
  const start = Date.now();
  const results = await reranker.rerank(query, documents, topK);
  console.log(`[Reranker] Done in ${Date.now() - start}ms`);
  return results;
}
