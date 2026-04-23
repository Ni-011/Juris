import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const BUCKET_NAME = "juris-documents";

async function main() {
  console.log("🚀 Initializing Supabase Storage...");

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("❌ Failed to list buckets:", listError.message);
    process.exit(1);
  }

  const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);

  if (bucketExists) {
    console.log(`✅ Bucket '${BUCKET_NAME}' already exists.`);
  } else {
    console.log(`⏳ Creating bucket '${BUCKET_NAME}'...`);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      allowedMimeTypes: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/html", "text/csv", "image/*"],
      fileSizeLimit: 52428800, // 50MB
    });

    if (createError) {
      console.error("❌ Failed to create bucket:", createError.message);
      process.exit(1);
    }
    console.log(`✅ Bucket '${BUCKET_NAME}' created successfully.`);
  }

  console.log("🎉 Supabase initialization complete!");
}

main().catch(console.error);
