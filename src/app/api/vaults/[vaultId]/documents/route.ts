import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, vaults, ingestionJobs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { generateReadUrl } from "@/lib/supabase-storage";
import { processIngestionJob } from "@/lib/pipeline";
import { createHash } from "crypto";

interface RouteParams {
  params: Promise<{ vaultId: string }>;
}

// Map common MIME types → our doc_type enum
function getDocType(
  mimeType: string,
  fileName: string
): "pdf" | "docx" | "txt" | "html" | "csv" | "image" {
  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  )
    return "docx";
  if (mimeType === "text/html" || fileName.endsWith(".html")) return "html";
  if (mimeType === "text/csv" || fileName.endsWith(".csv")) return "csv";
  if (
    mimeType.startsWith("image/") ||
    /\.(png|jpg|jpeg|tiff|bmp)$/i.test(fileName)
  )
    return "image";
  return "txt";
}

// GET /api/vaults/[vaultId]/documents – List documents in a vault
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { vaultId } = await params;

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.vaultId, vaultId))
      .orderBy(documents.uploadTime);

    return NextResponse.json({ documents: docs });
  } catch (error: any) {
    console.error("[Documents] List error:", error.message);
    return NextResponse.json(
      { error: "Failed to list documents" },
      { status: 500 }
    );
  }
}

// POST /api/vaults/[vaultId]/documents – Upload documents (multipart/form-data)
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const { vaultId } = await params;

    // Verify vault exists
    const [vault] = await db
      .select()
      .from(vaults)
      .where(eq(vaults.id, vaultId))
      .limit(1);

    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }

    const body = await req.json();
    const files = body.files as Array<{
      fileName: string;
      fileType: string;
      fileSize: number;
      storagePath: string;
    }>;
    const customMetadata = body.metadata || null;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided in completion request." },
        { status: 400 }
      );
    }

    // Create an ingestion job for this batch
    const [job] = await db
      .insert(ingestionJobs)
      .values({
        vaultId,
        tenantId: vault.tenantId,
        totalFiles: files.length,
      })
      .returning();

    const createdDocs: Array<{
      id: string;
      fileName: string;
      status: string;
    }> = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const file of files) {
      try {
        // Naive duplicate check proxy since file buffer isn't passed through backend anymore
        const checksumProxy = `${file.fileName}_${file.fileSize}`;

        // Check for duplicate
        const existingDocs = await db
          .select()
          .from(documents)
          .where(eq(documents.vaultId, vaultId));

        const duplicate = existingDocs.find((d) => d.checksum === checksumProxy);
        if (duplicate) {
          createdDocs.push({
            id: duplicate.id,
            fileName: file.fileName,
            status: `duplicate_of:${duplicate.id}`,
          });
          continue;
        }

        // Detect document type
        const docType = getDocType(file.fileType, file.fileName);

        // Generate the read URL now that the file actually exists
        const storageUrl = await generateReadUrl(file.storagePath);

        // Create document record
        const [doc] = await db
          .insert(documents)
          .values({
            vaultId,
            tenantId: vault.tenantId,
            fileName: file.fileName,
            docType,
            fileSize: file.fileSize,
            storagePath: file.storagePath,
            storageUrl,
            checksum: checksumProxy,
            customMetadata,
          })
          .returning();

        createdDocs.push({
          id: doc.id,
          fileName: doc.fileName,
          status: "pending",
        });
      } catch (fileError: any) {
        errors.push({ fileName: file.fileName, error: fileError.message });
      }
    }

    // Update job with initial counts
    await db
      .update(ingestionJobs)
      .set({
        processedFiles: createdDocs.filter((d) =>
          d.status !== "pending"
        ).length,
        failedFiles: errors.length,
        errorLog: errors.length > 0 ? errors.map((e) => ({ docId: "", error: `${e.fileName}: ${e.error}` })) : undefined,
      })
      .where(eq(ingestionJobs.id, job.id));

    // Fire-and-forget: process the entire ingestion job asynchronously
    if (createdDocs.some(d => d.status === "pending")) {
      processIngestionJob(job.id).catch((err) => {
        console.error(
          `[Upload] Background ingestion job failed for ${job.id}:`,
          err.message
        );
      });
    }

    return NextResponse.json(
      {
        jobId: job.id,
        uploaded: createdDocs.length,
        errors: errors.length,
        documents: createdDocs,
        uploadErrors: errors,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Documents] Upload error:", error.message);
    return NextResponse.json(
      { error: "Failed to upload documents" },
      { status: 500 }
    );
  }
}
