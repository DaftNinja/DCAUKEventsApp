import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import postgres from "postgres";
import authRoutes from "./routes/auth.js";
import usersRoutes from "./routes/users.js";
import eventsRoutes from "./routes/events.js";
import adminRoutes from "./routes/admin.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// Run migrations on startup
async function runMigrations() {
  try {
    const connectionString = process.env.DATABASE_URL;
    const client = postgres(connectionString, { max: 1 });

    console.log("🔄 Running database migrations...");

    const migrationsDir = path.join(__dirname, "migrations");
    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, "utf-8");
        console.log(`  Running ${file}...`);
        await client.query(sql);
      }
      console.log("✅ Migrations complete!");
    }

    await client.end();
  } catch (error) {
    console.warn("⚠️ Migration warning:", error.message);
  }
}

// Run migrations before starting server
await runMigrations();

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/admin", adminRoutes);

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

app.listen(PORT, () => {
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`  Frontend URL: ${process.env.FRONTEND_URL}`);
});