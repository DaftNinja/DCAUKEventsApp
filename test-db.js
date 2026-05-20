import dotenv from "dotenv";
dotenv.config();

import { db } from "./src/db/index.js";

console.log("Testing database connection...");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "✓ Set" : "✗ Not set");

try {
  const result = await db.select().from(db._).limit(1);
  console.log("✓ Connected!");
  process.exit(0);
} catch (err) {
  console.error("✗ Connection failed:", err.message);
  process.exit(1);
}
