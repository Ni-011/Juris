import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, analysisJobs, vaults, chatSessions, chatMessages } from "@/drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/utils/supabase/server";
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
    const { user } = await requireAuth();
    const { vaultId } = await params;
    const body = await req.json();
    let { messages, sessionId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    // 1. Ensure a session exists
    let session;
    if (sessionId) {
      [session] = await db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.tenantId, user.id)))
        .limit(1);
    }

    if (!session) {
      // Create new session if none provided or not found
      const [newSession] = await db
        .insert(chatSessions)
        .values({
          tenantId: user.id,
          vaultId: vaultId,
          title: messages[0].content.substring(0, 50) + (messages[0].content.length > 50 ? "..." : ""),
        })
        .returning();
      session = newSession;
      sessionId = session.id;
    }

    const latestMessage = messages[messages.length - 1];

    // 2. Save user message
    await db.insert(chatMessages).values({
      sessionId: sessionId,
      tenantId: user.id,
      role: "user",
      content: latestMessage.content,
    });

    console.log(`[Vault Query] Starting query for vault ${vaultId}: "${latestMessage.content.substring(0, 50)}..."`);

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
    const intent = await parseIntent(latestMessage.content, availableDocs);
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

    // 3. Create a wrapper stream to capture assistant response and save it
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let assistantContent = "";
    
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const decoded = decoder.decode(chunk, { stream: true });
        const lines = decoded.split("\n");
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.t) assistantContent += parsed.t;
          } catch (e) { /* ignore */ }
        }
        controller.enqueue(chunk);
      },
      async flush() {
        // Save assistant message when stream completes
        if (assistantContent) {
          await db.insert(chatMessages).values({
            sessionId: sessionId,
            tenantId: user.id,
            role: "assistant",
            content: assistantContent,
          });
          
          // Update session timestamp
          await db.update(chatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(chatSessions.id, sessionId));
        }
      }
    });

    return new Response(stream.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Session-Id': sessionId, // Send back session ID
      }
    });

  } catch (error: any) {
    console.error("[Vault Query API] Error:", error);
    return NextResponse.json({ error: "Failed to process query" }, { status: 500 });
  }
}
