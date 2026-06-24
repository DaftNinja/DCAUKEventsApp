import { Router } from "express";
import { db } from "../db/index.js";
import { userPreferences } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import crypto from "crypto";

const router = Router();

// ─── GET /api/preferences ─────────────────────────────────────────────────────
// Get or create preferences for the logged-in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    let [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, req.userId))
      .limit(1);

    if (!prefs) {
      [prefs] = await db
        .insert(userPreferences)
        .values({
          userId:    req.userId,
          keywords:  "",
          locations: "",
          calToken:  crypto.randomBytes(32).toString("hex"),
        })
        .returning();
    }

    res.json(prefs);
  } catch (error) {
    console.error("Failed to fetch preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// ─── PUT /api/preferences ─────────────────────────────────────────────────────
// Save preferences for the logged-in user
router.put("/", authenticateToken, async (req, res) => {
  try {
    const { keywords, locations } = req.body;

    const existing = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(eq(userPreferences.userId, req.userId))
      .limit(1);

    let prefs;
    if (existing.length === 0) {
      [prefs] = await db
        .insert(userPreferences)
        .values({
          userId:    req.userId,
          keywords:  keywords  ?? "",
          locations: locations ?? "",
          calToken:  crypto.randomBytes(32).toString("hex"),
        })
        .returning();
    } else {
      [prefs] = await db
        .update(userPreferences)
        .set({
          keywords:  keywords  ?? "",
          locations: locations ?? "",
          updatedAt: new Date(),
        })
        .where(eq(userPreferences.userId, req.userId))
        .returning();
    }

    res.json(prefs);
  } catch (error) {
    console.error("Failed to save preferences:", error);
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// ─── DELETE /api/preferences ─────────────────────────────────────────────────────
// Unsubscribe — deletes preferences row and invalidates the calendar feed token
router.delete("/", authenticateToken, async (req, res) => {
  try {
    await db
      .delete(userPreferences)
      .where(eq(userPreferences.userId, req.userId));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete preferences:", error);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
