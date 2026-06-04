import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";
import newsRoutes from "./routes/news.js";
import { fetchAndStoreNews } from "./services/newsFetcher.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
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
// ── Register the news route alongside other routes ──
app.use("/api/news", newsRoutes);

// ── Update startScheduler() to include news fetching ──
function startScheduler() {
  // Event reminders — run immediately then every hour
  sendEventReminders().catch(err => logger.error({ err }, "Reminder run failed"));
  setInterval(() => {
    sendEventReminders().catch(err => logger.error({ err }, "Reminder run failed"));
  }, 60 * 60 * 1000);

  // News feed — run immediately then every hour
  fetchAndStoreNews().catch(err => logger.error({ err }, "News fetch failed"));
  setInterval(() => {
    fetchAndStoreNews().catch(err => logger.error({ err }, "News fetch failed"));
  }, 60 * 60 * 1000);

  logger.info("Scheduler started (reminders + news, hourly)");
}
