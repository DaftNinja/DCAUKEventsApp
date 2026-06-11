import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./db.js";
import { router } from "./routes.js";
import { authRouter } from "./authRoutes.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = parseInt(process.env.PORT ?? "3000");
const IS_PROD = process.env.NODE_ENV === "production";

// Behind Railway's proxy — needed for secure cookies.
app.set("trust proxy", 1);

// ─── Core middleware ──────────────────────────────────────────────────────────

app.use(cors({ origin: process.env.CLIENT_URL ?? true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check — no DB dependency ─────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Session (must be set up before API routes that use it) ──────────────────

const PgStore = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgStore({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET ?? "1giglabs-dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
});

// ─── API routes (session-aware) ───────────────────────────────────────────────

app.use("/api/auth", sessionMiddleware, authRouter);
app.use("/api", sessionMiddleware, router);

// ─── Static files & SPA fallback ──────────────────────────────────────────────

const publicPath = path.join(__dirname, "..", "dist", "public");
app.use(express.static(publicPath));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err) {
      console.error(`Failed to serve index.html for ${req.path}:`, err);
      res.status(500).send("Server error");
    }
  });
});

// ─── Start listening ──────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 1GigLabs running on port ${PORT}`);
  console.log(`📁 Static: ${publicPath}`);
});

// ─── DB init (async after server starts) ─────────────────────────────────────

async function init() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await db.execute(sql`SELECT 1`);
      break;
    } catch (err) {
      if (attempt === 10) { console.error("❌ DB failed:", err); process.exit(1); }
      console.warn(`⏳ DB not ready (${attempt}/10), retrying in 3s…`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  try {
    // Users table — passwordless auth, so no password_hash / is_verified.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      company TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      report_credits INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP
    )`);

    // Migrate legacy schema — drop password-era columns if present.
    await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS password_hash`);
    await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS is_verified`);

    // Magic-link sign-in tokens.
    await db.execute(sql`CREATE TABLE IF NOT EXISTS signin_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_signin_tokens_token ON signin_tokens(token)`);
    // Legacy email_tokens table — leave in place if present; not used anymore.

    await db.execute(sql`CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY, user_id INTEGER, email TEXT, action TEXT NOT NULL,
      detail TEXT, ip_address TEXT, user_agent TEXT, created_at TIMESTAMP DEFAULT NOW()
    )`);

    await db.execute(sql`CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY, user_id INTEGER, company_name TEXT NOT NULL,
      company_slug TEXT NOT NULL UNIQUE, industry TEXT, report_data JSONB,
      sales_enablement_data JSONB, generated_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(), is_generating BOOLEAN DEFAULT FALSE
    )`);
    await db.execute(sql`ALTER TABLE reports ADD COLUMN IF NOT EXISTS user_id INTEGER`);

    console.log("✅ Database initialised");
  } catch (err) {
    console.error("❌ Failed to create tables:", err);
    process.exit(1);
  }
}

init();
