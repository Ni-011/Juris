import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, analysisJobs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { runDocumentAnalysis } from "@/lib/pipeline";

interface RouteParams {
  params: Promise<{ docId: string }>;
}

// GET /api/analysis/[docId] – Get analysis results for a document
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { docId } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    const analyses = await db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.documentId, docId));

    const completed = analyses.find(
      (a) => a.status === "completed" && a.jobType === "full_analysis"
    );
    const running = analyses.find(
      (a) => a.status === "running"
    );
    const queued = analyses.find(
      (a) => a.status === "queued"
    );

    return NextResponse.json({
      documentId: docId,
      fileName: doc.fileName,
      analysisStatus: completed
        ? "completed"
        : running
          ? "running"
          : queued
            ? "queued"
            : "none",
      result: completed?.result || null,
      jobs: analyses.map((a) => ({
        id: a.id,
        jobType: a.jobType,
        status: a.status,
        startedAt: a.startedAt,
        completedAt: a.completedAt,
      })),
    });
  } catch (error: any) {
    console.error("[Analysis] Get error:", error.message);
    return NextResponse.json(
      { error: "Failed to get analysis" },
      { status: 500 }
    );
  }
}

// POST /api/analysis/[docId] – Trigger analysis for a document
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { docId } = await params;

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);

    if (!doc) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.status !== "ready") {
      return NextResponse.json(
        {
          error: `Document is not ready for analysis (status: ${doc.status})`,
        },
        { status: 400 }
      );
    }

    // Fire-and-forget
    runDocumentAnalysis(docId).catch((err) => {
      console.error(
        `[Analysis] Background analysis failed for ${docId}:`,
        err.message
      );
    });

    return NextResponse.json({
      success: true,
      message: "Analysis started",
      documentId: docId,
    });
  } catch (error: any) {
    console.error("[Analysis] Trigger error:", error.message);
    return NextResponse.json(
      { error: "Failed to trigger analysis" },
      { status: 500 }
    );
  }
}
