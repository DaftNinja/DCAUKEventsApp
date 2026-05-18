import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { db } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import eventsRoutes from "./routes/events.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Run migrations on startup
async function runMigrations() {
  try {
    console.log("🔄 Running database migrations...");
    const result = await db.execute("SELECT version FROM __drizzle_migrations__");
    console.log("✓ Migrations table exists");
  } catch (error) {
    console.log("⚠️  First run - creating migrations table...");
    try {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS __drizzle_migrations__ (
          id SERIAL PRIMARY KEY,
          hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )
      `);
      console.log("✓ Migrations table created");
    } catch (e) {
      console.error("Migration setup failed:", e.message);
    }
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/events", eventsRoutes);

// Serve frontend static files
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Fallback to index.html for React routing
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  } else {
    res.status(404).json({ error: "Not found" });
  }
});

const PORT = process.env.PORT || 8080;

// Start server
(async () => {
  try {
    await runMigrations();
    
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`  Frontend URL: ${process.env.FRONTEND_URL}`);
      console.log(`  Backend URL: ${process.env.BACKEND_URL}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
})();
