import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import postgres from "postgres";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const client = postgres(connectionString);

  try {
    console.log("🔄 Running database migrations...");

    const migrationsDir = path.join(__dirname, "../migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");

      console.log(`  Running ${file}...`);
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    }

    console.log("✅ Migrations complete!");
    await client.end();
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  }
}

runMigrations();