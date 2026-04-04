import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vaults } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

// GET /api/vaults – List all vaults
export async function GET() {
  try {
    const allVaults = await db
      .select()
      .from(vaults)
      .orderBy(vaults.createdAt);

    return NextResponse.json({ vaults: allVaults });
  } catch (error: any) {
    console.error("[Vaults] List error:", error.message);
    return NextResponse.json(
      { error: "Failed to list vaults" },
      { status: 500 }
    );
  }
}

// POST /api/vaults – Create a new vault
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, description, tenantId } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const [newVault] = await db
      .insert(vaults)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        tenantId: tenantId || "default",
      })
      .returning();

    return NextResponse.json({ vault: newVault }, { status: 201 });
  } catch (error: any) {
    console.error("[Vaults] Create error:", error.message);
    return NextResponse.json(
      { error: "Failed to create vault" },
      { status: 500 }
    );
  }
}
