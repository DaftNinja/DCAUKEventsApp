import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // maximum pool size
  idleTimeoutMillis: 30000,   // close idle clients after 30s
  connectionTimeoutMillis: 2000, // error if connection takes > 2s
});

export const db = drizzle(pool, { schema });

export async function checkDatabaseConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✓ Database connected:", result.rows[0]);
    return true;
  } catch (error) {
    console.error("✗ Database connection failed:", error.message);
    return false;
  }
}

