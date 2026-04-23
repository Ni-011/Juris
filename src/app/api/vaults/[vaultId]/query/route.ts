import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, analysisJobs } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  parseIntent,
  buildFilters,
  retrieveAndRerank,
  balanceEvidence,
  compileResponseStream
} from "@/lib/query-pipeline";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ vaultId: string }> }
) {
  try {
    const { vaultId } = await params;
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1].content;

    console.log(`[Vault Query] Starting query for vault ${vaultId}: "${latestMessage.substring(0, 50)}..."`);

    // 1. Fetch available docs in vault for the intent parser
    const availableDocs = await db
      .select({ id: documents.id, fileName: documents.fileName, docType: documents.docType })
      .from(documents)
      .where(and(
        eq(documents.vaultId, vaultId),
        eq(documents.status, "ready")
      ));

    if (availableDocs.length === 0) {
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ t: "This vault has no processed documents yet. Please upload files and wait for them to process." }) + "\n"));
            controller.close();
          }
        }), { headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Pipeline Stages
    const intent = await parseIntent(latestMessage, availableDocs);
    const filters = buildFilters(vaultId, intent);
    const rawMatches = await retrieveAndRerank(intent, filters);
    const balancedEvidence = balanceEvidence(rawMatches, intent);

    // In case of a single document focus, pull the global analysis directly natively into the context
    if (intent.scope === "single_doc" && intent.metadata_filters.file_names && intent.metadata_filters.file_names.length === 1) {
      const fileName = intent.metadata_filters.file_names[0];
      const docMatch = availableDocs.find(d => d.fileName === fileName);
      if (docMatch) {
        const analysisJob = await db
          .select()
          .from(analysisJobs)
          .where(and(eq(analysisJobs.documentId, docMatch.id), eq(analysisJobs.jobType, "full_analysis"), eq(analysisJobs.status, "completed")))
          .limit(1);

        if (analysisJob && analysisJob.length > 0 && analysisJob[0].result) {
          const result = analysisJob[0].result as any;
          const docSummaryObj = result.doc_summary;
          const keyEntitiesObj = result.key_entities;

          const docSummaryStr = docSummaryObj ?
            `Document Summary: ${docSummaryObj.summary}\nThemes: ${(docSummaryObj.key_themes || []).join(', ')}\nPurpose: ${docSummaryObj.document_purpose}` : "";

          const keyEntitiesStr = keyEntitiesObj ?
            `Key Entities: ${JSON.stringify(keyEntitiesObj)}` : "";

          const analysisContent = `[GLOBAL DOCUMENT ANALYSIS]\n${docSummaryStr}\n\n${keyEntitiesStr}`;

          if (docSummaryStr.trim() || keyEntitiesStr.trim()) {
            balancedEvidence.unshift({
              id: `${docMatch.id}_analysis_direct`,
              doc_id: docMatch.id,
              file_name: docMatch.fileName,
              page_number: 0,
              section_heading: "Global Document Analysis",
              content: analysisContent,
              score: 1.0
            } as any);
            console.log(`[Vault Query] Slipped direct global analysis into context window for ${fileName}`);
          }
        }
      }
    }

    // Stream response
    const stream = await compileResponseStream(messages, balancedEvidence);

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

  } catch (error: any) {
    console.error("[Vault Query API] Error:", error);
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
  }
}
