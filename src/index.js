import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import cron from "node-cron";
import adminRoutes  from "./routes/admin.js";
import authRoutes   from "./routes/auth.js";
import userRoutes   from "./routes/users.js";
import eventRoutes  from "./routes/events.js";
import newsRoutes   from "./routes/news.js";
import groupRoutes  from "./routes/groups.js";
import { runMigrations }     from "./db/migrate.js";
import { sendEventReminders } from "./services/reminders.js";
import { fetchAndStoreNews }  from "./services/newsFetcher.js";
import { logger }             from "./utils/logger.js";

// ─── App ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Core middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" },
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/admin",  adminRoutes);
app.use("/api/auth",   authRoutes);
app.use("/api/users",  userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/news",   newsRoutes);
app.use("/api/groups", groupRoutes);

// ─── Serve React frontend ─────────────────────────────────────────────────────
const frontendDist = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ─── Central error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "An unexpected error occurred"
      : err.message || "An unexpected error occurred";
  res.status(status).json({ error: message });
});

// ─── Scheduler ────────────────────────────────────────────────────────────────
function startScheduler() {
  // Run immediately on startup to populate on first deploy
  sendEventReminders().catch(err => logger.error({ err }, "Initial reminder run failed"));
  fetchAndStoreNews().catch(err => logger.error({ err }, "Initial news fetch failed"));

  // Run at the top of every hour — cron prevents execution drift vs setInterval
  cron.schedule("0 * * * *", async () => {
    try {
      logger.info("Running scheduled hourly tasks...");
      await sendEventReminders();
      await fetchAndStoreNews();
    } catch (err) {
      logger.error({ err }, "Scheduled tasks failed");
    }
  });

  logger.info("Scheduler started — cron running at top of every hour");
}

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    logger.info("Running migrations...");
    await runMigrations();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
      startScheduler();
    });
  } catch (err) {
    logger.error({ err }, "Startup failed");
    process.exit(1);
  }
}

start();
