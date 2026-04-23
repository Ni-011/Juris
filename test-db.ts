import postgres from "postgres";
import "dotenv/config";

async function check() {
  console.log("Connecting to", process.env.DATABASE_URL);
  try {
    const sql = postgres(process.env.DATABASE_URL!);
    const result = await sql`SELECT 1 as connected`;
    console.log("Success:", result);
    process.exit(0);
  } catch (err: any) {
    console.error("Error connecting:", err);
    process.exit(1);
  }
}
check();
