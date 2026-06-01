import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });

  const db = drizzle(pool);

  console.log("🔄 Running migrations...");
  await migrate(db, {
    migrationsFolder: path.join(__dirname, "migrations"),
  });
  console.log("✅ Migrations complete");

  await pool.end();
}
