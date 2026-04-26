import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "@/utils/supabase/server";

// List all chat sessions for the user
export async function GET(req: Request) {
  try {
    const { user } = await requireAuth();
    const url = new URL(req.url);
    const vaultId = url.searchParams.get("vaultId");

    let query = db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.tenantId, user.id))
      .orderBy(desc(chatSessions.updatedAt));

    // If vaultId is provided, filter sessions by vault
    if (vaultId) {
      query = db
        .select()
        .from(chatSessions)
        .where(and(eq(chatSessions.tenantId, user.id), eq(chatSessions.vaultId, vaultId)))
        .orderBy(desc(chatSessions.updatedAt)) as any;
    }

    const sessions = await query;
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[Chat Sessions GET] Error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Create a new chat session
export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const body = await req.json();
    const { title, vaultId } = body;

    const [newSession] = await db
      .insert(chatSessions)
      .values({
        tenantId: user.id,
        title: title || "New Conversation",
        vaultId: vaultId || null,
      })
      .returning();

    return NextResponse.json({ session: newSession });
  } catch (error) {
    console.error("[Chat Sessions POST] Error:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}
