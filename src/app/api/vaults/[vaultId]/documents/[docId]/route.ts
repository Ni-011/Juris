import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  documents,
  documentChunks,
  analysisJobs,
} from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { deleteDocumentVectors } from "@/lib/pinecone";
import { deleteFile } from "@/lib/supabase-storage";
import { processDocumentFull } from "@/lib/pipeline";

interface RouteParams {
  params: Promise<{ vaultId: string; docId: string }>;
}

// GET /api/vaults/[vaultId]/documents/[docId] – Get document details
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { vaultId, docId } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.vaultId, vaultId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get chunk count
    const chunks = await db
      .select()
      .from(documentChunks)
      .where(eq(documentChunks.documentId, docId));

    // Get analysis results
    const analyses = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.documentId, docId));

    return NextResponse.json({
      document: doc,
      chunkCount: chunks.length,
      totalTokens: chunks.reduce((sum, c) => sum + (c.tokenCount || 0), 0),
      analyses: analyses.map((a) => ({
        id: a.id,
        jobType: a.jobType,
        status: a.status,
        result: a.result,
        completedAt: a.completedAt,
      })),
    });
  } catch (error: any) {
    console.error("[Document] Get error:", error.message);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 }
    );
  }
}

// DELETE /api/vaults/[vaultId]/documents/[docId] – Delete a document
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { vaultId, docId } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.vaultId, vaultId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete Pinecone vectors
    await deleteDocumentVectors(docId).catch((e) =>
      console.error(`Failed to delete vectors: ${e.message}`)
    );

    // Delete from Supabase Storage
    if (doc.storagePath) {
      await deleteFile(doc.storagePath).catch((e) =>
        console.error(`Failed to delete file: ${e.message}`)
      );
    }

    // DB cascade handles chunks and analysis jobs
    await db.delete(documents).where(eq(documents.id, docId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Document] Delete error:", error.message);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}

// POST /api/vaults/[vaultId]/documents/[docId] – Re-process a document
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { vaultId, docId } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, docId), eq(documents.vaultId, vaultId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Clear existing chunks and vectors
    await deleteDocumentVectors(docId).catch(() => {});
    await db
      .delete(documentChunks)
      .where(eq(documentChunks.documentId, docId));
    await db
      .delete(analysisJobs)
      .where(eq(analysisJobs.documentId, docId));

    // Reset status
    await db
      .update(documents)
      .set({ status: "pending", errorMessage: null, updatedAt: new Date() })
      .where(eq(documents.id, docId));

    // Re-trigger processing
    processDocumentFull(docId).catch((err) => {
      console.error(`[Document] Re-process failed for ${docId}:`, err.message);
    });

    return NextResponse.json({
      success: true,
      message: "Document re-processing started",
    });
  } catch (error: any) {
    console.error("[Document] Re-process error:", error.message);
    return NextResponse.json(
      { error: "Failed to re-process document" },
      { status: 500 }
    );
  }
}
