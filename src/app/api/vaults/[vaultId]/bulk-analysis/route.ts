import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bulkAnalysisJobs } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { spawn } from "child_process";
import path from "path";

// GET /api/vaults/[vaultId]/bulk-analysis - List jobs for a vault
export async function GET(
  req: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    
    const jobs = await db
      .select({
        id: bulkAnalysisJobs.id,
        userPrompt: bulkAnalysisJobs.userPrompt,
        status: bulkAnalysisJobs.status,
        totalDocs: bulkAnalysisJobs.totalDocs,
        completedShards: bulkAnalysisJobs.completedShards,
        createdAt: bulkAnalysisJobs.createdAt,
        errorMessage: bulkAnalysisJobs.errorMessage,
        finalResult: bulkAnalysisJobs.finalResult
      })
      .from(bulkAnalysisJobs)
      .where(eq(bulkAnalysisJobs.vaultId, vaultId))
      .orderBy(desc(bulkAnalysisJobs.createdAt));

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("[Bulk Analysis API] Get jobs error:", error);
    return NextResponse.json({ error: "Failed to get jobs" }, { status: 500 });
  }
}

// POST /api/vaults/[vaultId]/bulk-analysis - Create a new bulk analysis job
export async function POST(
  req: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Insert job into DB
    const [newJob] = await db
      .insert(bulkAnalysisJobs)
      .values({
        vaultId,
        userPrompt: prompt,
        status: "queued"
      })
      .returning();

    // Spawn background script
    const scriptPath = path.join(process.cwd(), "scripts", "bulk-analyzer.ts");
    
    // We use ts-node via npx to run the typescript script directly
    const analyzer = spawn("npx", ["ts-node", scriptPath, newJob.id], {
      detached: true,
      stdio: "ignore", // Let it run entirely decoupled
    });
    
    analyzer.unref(); // Don't hold the Node event loop open for the child

    return NextResponse.json({ 
      success: true, 
      jobId: newJob.id,
      message: "Bulk analysis started in background" 
    });

  } catch (error: any) {
    console.error("[Bulk Analysis API] Create job error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
