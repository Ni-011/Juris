import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vaults, documents, documentChunks, ingestionJobs, analysisJobs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { deleteVaultFiles } from "@/lib/supabase-storage";
import { deleteVaultVectors } from "@/lib/pinecone";
import { requireAuth } from "@/utils/supabase/server";

interface RouteParams {
  params: Promise<{ vaultId: string }>;
}

// GET /api/vaults/[vaultId] – Get a single vault with stats
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { user } = await requireAuth();
    const { vaultId } = await params;

    const [vault] = await db
      .select()
      .from(vaults)
      .where(and(eq(vaults.id, vaultId), eq(vaults.tenantId, user.id)))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: "Vault not found or unauthorized" }, { status: 404 });
    }

    // Get document count and status breakdown
    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.vaultId, vaultId));

    const stats = {
      totalDocuments: docs.length,
      byStatus: {
        pending: docs.filter((d) => d.status === "pending").length,
        processing: docs.filter((d) =>
          ["parsing", "chunking", "embedding", "analyzing"].includes(d.status)
        ).length,
        ready: docs.filter((d) => d.status === "ready").length,
        failed: docs.filter((d) => d.status === "failed").length,
      },
      totalSize: docs.reduce((sum, d) => sum + (d.fileSize || 0), 0),
    };

    return NextResponse.json({ vault, stats });
  } catch (error: any) {
    console.error("[Vault] Get error:", error.message);
    return NextResponse.json(
      { error: "Failed to get vault" },
      { status: 500 }
    );
  }
}

// PATCH /api/vaults/[vaultId] – Update vault metadata
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { user } = await requireAuth();
    const { vaultId } = await params;
    const body = await req.json();
    const { name, description } = body;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;

    const [updated] = await db
      .update(vaults)
      .set(updates)
      .where(and(eq(vaults.id, vaultId), eq(vaults.tenantId, user.id)))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Vault not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ vault: updated });
  } catch (error: any) {
    console.error("[Vault] Update error:", error.message);
    return NextResponse.json(
      { error: "Failed to update vault" },
      { status: 500 }
    );
  }
}

// DELETE /api/vaults/[vaultId] – Delete vault and cascade
export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { user } = await requireAuth();
    const { vaultId } = await params;

    // Check vault exists and belongs to user
    const [vault] = await db
      .select()
      .from(vaults)
      .where(and(eq(vaults.id, vaultId), eq(vaults.tenantId, user.id)))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: "Vault not found or unauthorized" }, { status: 404 });
    }

    // Clean up Pinecone vectors for the vault
    await deleteVaultVectors(vaultId).catch((e) =>
      console.error(`Failed to delete Pinecone vectors: ${e.message}`)
    );

    // Clean up Supabase Storage files
    await deleteVaultFiles(vaultId).catch((e) =>
      console.error(`Failed to delete storage files: ${e.message}`)
    );

    // DB cascade will handle documents, chunks, jobs
    await db.delete(vaults).where(eq(vaults.id, vaultId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Vault] Delete error:", error.message);
    return NextResponse.json(
      { error: "Failed to delete vault" },
      { status: 500 }
    );
  }
}
