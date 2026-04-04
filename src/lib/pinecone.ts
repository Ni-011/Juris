import { Pinecone } from "@pinecone-database/pinecone";

/**
 * Pinecone Client Wrapper
 * Index: juris-legal-docs | Dimension: 1024 | Metric: cosine
 */

const pc = new Pinecone({
  apiKey: process.env.PINECONE_DB_KEY!,
});

const INDEX_NAME = "juris-legal-docs";

export function getIndex() {
  return pc.index({ name: INDEX_NAME });
}

// ─── Metadata types ────────────────────────────────────

export interface VectorMetadata {
  doc_id: string;
  vault_id: string;
  tenant_id: string;
  file_name: string;
  doc_type: string;
  source: string;
  upload_time: string;
  page_number: number;
  section_heading: string;
  chunk_index: number;
  chunk_type: string;
  language: string;
  token_count: number;
  checksum: string;
  [key: string]: string | number | boolean | string[];
}

export interface UpsertVector {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

// ─── Operations ────────────────────────────────────────

/**
 * Upsert vectors into Pinecone in batches of up to 100.
 */
export async function upsertVectors(
  vectors: UpsertVector[],
  namespace: string = ""
): Promise<void> {
  const index = getIndex();
  const BATCH_SIZE = 100;

  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.upsert({
      records: batch,
      ...(namespace && { namespace }),
    });
    console.log(
      `[Pinecone] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}`
    );
  }
}

/**
 * Query Pinecone with metadata filters.
 */
export async function queryVectors(
  embedding: number[],
  topK: number = 10,
  filter?: Record<string, unknown>,
  namespace: string = ""
): Promise<any[]> {
  const index = getIndex();

  const result = await index.query({
    vector: embedding,
    topK,
    filter: filter as any,
    includeMetadata: true,
    ...(namespace && { namespace }),
  });

  return result.matches || [];
}

/**
 * Delete all vectors for a specific document.
 */
export async function deleteDocumentVectors(
  documentId: string,
  namespace: string = ""
): Promise<void> {
  const index = getIndex();

  const nsOpt = namespace ? { namespace } : {};

  // Pinecone serverless supports deleteMany with metadata filter
  try {
    await index.deleteMany({
      filter: { doc_id: { $eq: documentId } },
      ...nsOpt,
    });
    console.log(`[Pinecone] Deleted vectors for document ${documentId}`);
  } catch (error: any) {
    console.error(`[Pinecone] Delete failed: ${error.message}`);
    // Fallback: list and delete by IDs
    const results = await index.query({
      vector: new Array(1024).fill(0), // dummy vector
      topK: 10000,
      filter: { doc_id: { $eq: documentId } },
      includeMetadata: false,
      ...nsOpt,
    });
    if (results.matches && results.matches.length > 0) {
      const ids = results.matches.map((m) => m.id);
      await index.deleteMany({ ids, ...nsOpt });
    }
  }
}

/**
 * Delete all vectors for a vault.
 */
export async function deleteVaultVectors(
  vaultId: string,
  namespace: string = ""
): Promise<void> {
  const index = getIndex();

  try {
    await index.deleteMany({
      filter: { vault_id: { $eq: vaultId } },
      ...(namespace && { namespace }),
    });
    console.log(`[Pinecone] Deleted all vectors for vault ${vaultId}`);
  } catch (error: any) {
    console.error(`[Pinecone] Vault delete failed: ${error.message}`);
  }
}

/**
 * Fetch top matching chunks metadata for a vault without vectors.
 * Useful for bulk analysis classification tier 1.
 */
export async function queryVaultMetadata(
  embedding: number[],
  vaultId: string,
  topK: number = 1000,
  namespace: string = ""
): Promise<any[]> {
  const index = getIndex();

  const result = await index.query({
    vector: embedding,
    topK,
    filter: { vault_id: { $eq: vaultId } },
    includeMetadata: true,
    includeValues: false,
    ...(namespace && { namespace }),
  });

  return result.matches || [];
}
