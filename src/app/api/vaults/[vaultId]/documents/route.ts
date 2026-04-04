import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, vaults, ingestionJobs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { uploadFile } from "@/lib/supabase-storage";
import { processDocumentFull } from "@/lib/pipeline";
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

    // Parse multipart form data
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const customMetadataRaw = formData.get("metadata") as string | null;

    let customMetadata: Record<string, unknown> | null = null;
    if (customMetadataRaw) {
      try {
        customMetadata = JSON.parse(customMetadataRaw);
      } catch {
        /* ignore bad metadata */
      }
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided. Use 'files' field name in formData." },
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
        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Compute SHA-256 checksum
        const checksum = createHash("sha256").update(buffer).digest("hex");

        // Check for duplicate (same vault + same checksum)
        const existingDocs = await db
          .select()
          .from(documents)
          .where(eq(documents.vaultId, vaultId));

        const duplicate = existingDocs.find((d) => d.checksum === checksum);
        if (duplicate) {
          createdDocs.push({
            id: duplicate.id,
            fileName: file.name,
            status: `duplicate_of:${duplicate.id}`,
          });
          continue;
        }

        // Detect document type
        const docType = getDocType(file.type, file.name);

        // Upload to Supabase Storage
        const { storagePath, storageUrl } = await uploadFile(
          buffer,
          file.name,
          vaultId,
          file.type || "application/octet-stream"
        );

        // Create document record
        const [doc] = await db
          .insert(documents)
          .values({
            vaultId,
            tenantId: vault.tenantId,
            fileName: file.name,
            docType,
            fileSize: buffer.length,
            storagePath,
            storageUrl,
            checksum,
            customMetadata,
          })
          .returning();

        createdDocs.push({
          id: doc.id,
          fileName: doc.fileName,
          status: "pending",
        });

        // Fire-and-forget: process document asynchronously
        // This is the key: the upload response returns immediately,
        // while processing happens in the background
        processDocumentFull(doc.id).catch((err) => {
          console.error(
            `[Upload] Background processing failed for ${doc.id}:`,
            err.message
          );
        });
      } catch (fileError: any) {
        errors.push({ fileName: file.name, error: fileError.message });
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
