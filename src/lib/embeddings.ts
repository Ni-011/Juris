import OpenAI from "openai";

/**
 * NVIDIA NIM Embedding Client
 * Uses nvidia/nv-embedqa-e5-v5 (1024 dimensions) via the OpenAI-compatible API.
 */

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_EMBED_KEY || process.env.NVIDIA || process.env.NVIDEA,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const EMBEDDING_MODEL = "nvidia/nv-embedqa-e5-v5";
export const EMBEDDING_DIMENSIONS = 1024;

// NVIDIA supports a max of 2048 characters per input for this model in some cases.
// We batch to stay safe and handle rate limiting.
const MAX_BATCH_SIZE = 50;

export interface EmbeddingResult {
  index: number;
  embedding: number[];
}

/**
 * Generate embeddings for a single text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const results = await generateEmbeddings([text]);
  return results[0].embedding;
}

/**
 * Generate embeddings for a batch of texts.
 * Handles batching automatically to stay within API limits.
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  const allResults: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
    const batch = texts.slice(i, i + MAX_BATCH_SIZE);

    // Truncate any texts over 8000 chars to be safe
    const safeBatch = batch.map((t) =>
      t.length > 8000 ? t.slice(0, 8000) : t
    );

    let retries = 0;
    const maxRetries = 3;

    while (retries < maxRetries) {
      try {
        const response = await nvidia.embeddings.create({
          model: EMBEDDING_MODEL,
          input: safeBatch,
          encoding_format: "float",
        });

        for (const item of response.data) {
          allResults.push({
            index: i + item.index,
            embedding: item.embedding as unknown as number[],
          });
        }
        break;
      } catch (error: any) {
        retries++;
        if (error?.status === 429 || error?.status === 503) {
          const delay = 1000 * Math.pow(2, retries);
          console.warn(
            `[Embeddings] Rate limited, retrying in ${delay}ms (attempt ${retries}/${maxRetries})`
          );
          await new Promise((r) => setTimeout(r, delay));
        } else if (retries >= maxRetries) {
          throw error;
        } else {
          const delay = 500 * retries;
          console.warn(
            `[Embeddings] Error: ${error?.message}, retrying in ${delay}ms`
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }

  return allResults.sort((a, b) => a.index - b.index);
}
