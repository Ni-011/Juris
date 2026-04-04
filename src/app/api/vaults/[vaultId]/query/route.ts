import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents } from "@/drizzle/schema";
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
