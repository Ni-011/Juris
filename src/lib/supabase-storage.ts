import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use the service-role key for server-side storage operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = "juris-documents";

/**
 * Upload a file or buffer to Supabase Storage.
 * Returns the storage path and a signed URL.
 */
export async function uploadFile(
  fileData: Buffer | File,
  fileName: string,
  vaultId: string,
  contentType: string
): Promise<{ storagePath: string; storageUrl: string }> {
  const storagePath = `${vaultId}/${Date.now()}_${fileName}`;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileData, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Generate a signed URL valid for 7 days (for the Python sidecar to download)
  const { data: signedData, error: signedError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL: ${signedError?.message || "No URL returned"}`
    );
  }

  return { storagePath, storageUrl: signedData.signedUrl };
}

/**
 * Download a file from Supabase Storage as a Buffer.
 */
export async function downloadFile(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (error || !data) {
    throw new Error(`Supabase download failed: ${error?.message || "No data"}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([storagePath]);

  if (error) {
    console.error(`Failed to delete file from storage: ${error.message}`);
  }
}

/**
 * Delete all files for a vault.
 */
export async function deleteVaultFiles(vaultId: string): Promise<void> {
  const { data: files, error: listError } = await supabase.storage
    .from(BUCKET_NAME)
    .list(vaultId);

  if (listError || !files) {
    console.error(`Failed to list vault files: ${listError?.message}`);
    return;
  }

  if (files.length > 0) {
    const paths = files.map((f) => `${vaultId}/${f.name}`);
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(paths);
    if (error) {
      console.error(`Failed to delete vault files: ${error.message}`);
    }
  }
}

/**
 * Generate a pre-signed URL for direct client-side uploads.
 */
export async function generateUploadUrl(fileName: string, vaultId: string): Promise<{ storagePath: string; uploadUrl: string }> {
  const storagePath = `${vaultId}/${Date.now()}_${fileName}`;
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed upload URL: ${error?.message || "No URL"}`);
  }

  return { storagePath, uploadUrl: data.signedUrl };
}

/**
 * Generate a 7-day pre-signed URL for reading a file that already exists.
 */
export async function generateReadUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed read URL: ${error?.message || "No URL"}`);
  }
  return data.signedUrl;
}

