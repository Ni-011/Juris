import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatSessions, chatMessages } from "@/drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth } from "@/utils/supabase/server";
import { randomUUID } from "crypto";

// Get session details and messages
export async function GET(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user } = await requireAuth();
    const { sessionId } = await params;

    // Verify session belongs to user
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.tenantId, user.id)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(asc(chatMessages.createdAt));

    return NextResponse.json({ session, messages });
  } catch (error) {
    console.error("[Chat Session GET] Error:", error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

// Update session (e.g., sharing)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user } = await requireAuth();
    const { sessionId } = await params;
    const body = await req.json();
    const { isPublic, title } = body;

    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.tenantId, user.id)))
      .limit(1);

    if (!session) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (typeof isPublic === "boolean") {
      updateData.isPublic = isPublic;
      if (isPublic && !session.shareToken) {
        updateData.shareToken = randomUUID();
      }
    }
    if (title) updateData.title = title;

    const [updated] = await db
      .update(chatSessions)
      .set(updateData)
      .where(eq(chatSessions.id, sessionId))
      .returning();

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("[Chat Session PATCH] Error:", error);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { user } = await requireAuth();
    const { sessionId } = await params;

    const result = await db
      .delete(chatSessions)
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.tenantId, user.id)))
      .returning();

    if (result.length === 0) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Chat Session DELETE] Error:", error);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
