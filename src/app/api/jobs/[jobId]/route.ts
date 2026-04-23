import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ingestionJobs, documents } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// GET /api/jobs/[jobId] – Get job status and progress
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { jobId } = await params;

    const [job] = await db
      .select()
      .from(ingestionJobs)
      .where(eq(ingestionJobs.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Get current document statuses for this vault
    const docs = await db
      .select({
        id: documents.id,
        fileName: documents.fileName,
        status: documents.status,
        errorMessage: documents.errorMessage,
      })
      .from(documents)
      .where(eq(documents.vaultId, job.vaultId));

    const progress = {
      total: docs.length,
      pending: docs.filter((d) => d.status === "pending").length,
      processing: docs.filter((d) =>
        ["parsing", "chunking", "embedding", "analyzing"].includes(d.status)
      ).length,
      ready: docs.filter((d) => d.status === "ready").length,
      failed: docs.filter((d) => d.status === "failed").length,
    };

    return NextResponse.json({
      job,
      progress,
      documents: docs,
    });
  } catch (error: any) {
    console.error("[Jobs] Get error:", error.message);
    return NextResponse.json(
      { error: "Failed to get job status" },
      { status: 500 }
    );
  }
}
