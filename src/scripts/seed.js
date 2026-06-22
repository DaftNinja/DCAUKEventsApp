/**
 * src/scripts/seed.js
 *
 * Standalone database seeding script.
 * Run with: npm run db:seed
 *
 * This is intentionally decoupled from the server startup sequence
 * to prevent accidental duplicate writes on restarts/deployments.
 */

import "dotenv/config";
import { ingestEvents } from "./ingest-events.js";
import { pool } from "../db/index.js";

async function runSeed() {
  console.log("🌱 Starting database seeding...");

  try {
    await ingestEvents();
    console.log("✅ Database seeding completed successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Database seeding failed:", error.message);
    process.exit(1);
  } finally {
    // Gracefully close the pool so the process can exit cleanly
    await pool.end();
  }
}

runSeed();
