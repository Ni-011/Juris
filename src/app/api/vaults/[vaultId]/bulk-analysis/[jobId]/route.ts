import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bulkAnalysisJobs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ vaultId: string, jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    const [job] = await db
      .select({
        id: bulkAnalysisJobs.id,
        status: bulkAnalysisJobs.status,
        userPrompt: bulkAnalysisJobs.userPrompt,
        plan: bulkAnalysisJobs.plan,
        totalDocs: bulkAnalysisJobs.totalDocs,
        relevantDocs: bulkAnalysisJobs.relevantDocs,
        completedShards: bulkAnalysisJobs.completedShards,
        failedShards: bulkAnalysisJobs.failedShards,
        errorMessage: bulkAnalysisJobs.errorMessage,
        finalResult: bulkAnalysisJobs.finalResult,
        createdAt: bulkAnalysisJobs.createdAt,
        completedAt: bulkAnalysisJobs.completedAt
      })
      .from(bulkAnalysisJobs)
      .where(eq(bulkAnalysisJobs.id, jobId));

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (error: any) {
    console.error("[Bulk Analysis API] Get job status error:", error);
    return NextResponse.json({ error: "Failed to get job status" }, { status: 500 });
  }
}
