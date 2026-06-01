import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pino from "pino";
import pinoHttp from "pino-http";
import authRoutes   from "./routes/auth.js";
import userRoutes   from "./routes/users.js";
import eventRoutes  from "./routes/events.js";
import { runMigrations } from "./db/migrate.js";
import { ingestEvents }  from "./scripts/ingest-events.js";

// ─── Logger ───────────────────────────────────────────────────────────────────
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  // Pretty-print in development, structured JSON in production
  ...(process.env.NODE_ENV !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
});


// ─── App ──────────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Core middleware ──────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// HTTP request logging — skips /health to keep logs clean
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" },
}));

// ─── Health check ─────────────────────────────────────────────────────────────
// Used by Railway uptime checks. Returns 200 when the server is running.
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",   authRoutes);
app.use("/api/users",  userRoutes);
app.use("/api/events", eventRoutes);

// ─── Serve React frontend (production) ───────────────────────────────────────
const frontendDist = path.join(__dirname, "../frontend/dist");
app.use(express.static(frontendDist));
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

// ─── Central error handler ────────────────────────────────────────────────────
// Catches anything that calls next(err) or throws in async routes
// Never exposes raw error.message to clients in production
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;

  // Always log the full error server-side
  logger.error({ err, url: req.url, method: req.method }, "Unhandled error");

  // Safe client-facing message
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "An unexpected error occurred"
      : err.message || "An unexpected error occurred";

  res.status(status).json({ error: message });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    // logger.info("Running migrations...");
    // await runMigrations();

    // logger.info("Ingesting events...");
    // await ingestEvents();

    app.listen(PORT, () => {
      logger.info({ port: PORT }, "Server started");
    });
  } catch (err) {
    logger.error({ err }, "Startup failed");
    process.exit(1);
  }
}

start();
