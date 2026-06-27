import { Router } from "express";
import { db } from "../db/index.js";
import { newsItems } from "../db/schema.js";
import { eq, desc, gte, lt, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { attachUser, requireAdmin } from "../middleware/authorize.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";

const router = Router();

const createNewsSchema = z.object({
  title:       z.string().min(3).max(500),
  url:         z.string().url(),
  summary:     z.string().max(500).optional(),
  source:      z.string().min(1).max(200),
  imageUrl:    z.string().url().optional().or(z.literal("")),
  publishedAt: z.string().datetime().optional(),
});

// ─── GET /api/news ────────────────────────────────────────────────────────────
// Public — no auth required (used by homepage carousel for logged-out visitors)
// ?day=N — returns articles published N days ago (0 = today, 1 = yesterday, …)
// Maximum window is 7 days. Omitting ?day returns day 0 (today).
router.get("/", async (req, res) => {
  try {
    const MAX_DAYS = 7;
    const day = Math.min(Math.max(parseInt(req.query.day ?? "0", 10) || 0, 0), MAX_DAYS - 1);

    // Build a UTC midnight-aligned window for the requested day
    const now   = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));

    const items = await db
      .select()
      .from(newsItems)
      .where(
        day === 0
          // Day 0: everything from UTC midnight today onwards (catches items published "today")
          ? gte(newsItems.publishedAt, start)
          : and(gte(newsItems.publishedAt, start), lt(newsItems.publishedAt, end))
      )
      .orderBy(desc(newsItems.publishedAt))
      .limit(60);

    // Tell the client whether there are more days left to load
    res.json({ items, day, hasMore: day < MAX_DAYS - 1 });
  } catch (error) {
    console.error("Failed to fetch news:", error);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

// ─── POST /api/news ───────────────────────────────────────────────────────────
// Admin only — manually post a news item
router.post("/", authenticateToken, attachUser, requireAdmin, validate(createNewsSchema), async (req, res) => {
  try {
    const { title, url, summary, source, imageUrl, publishedAt } = req.body;

    const [item] = await db
      .insert(newsItems)
      .values({
        title,
        url,
        summary:     summary     || null,
        source,
        imageUrl:    imageUrl    || null,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        type:        "manual",
      })
      .returning();

    res.status(201).json(item);
  } catch (error) {
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "A news item with that URL already exists" });
    }
    console.error("Failed to create news item:", error);
    res.status(500).json({ error: "Failed to create news item" });
  }
});

// ─── DELETE /api/news/:id ─────────────────────────────────────────────────────
// Admin only
router.delete("/:id", authenticateToken, attachUser, requireAdmin, async (req, res) => {
  try {
    const [deleted] = await db
      .delete(newsItems)
      .where(eq(newsItems.id, req.params.id))
      .returning({ id: newsItems.id });

    if (!deleted) return res.status(404).json({ error: "News item not found" });
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete news item:", error);
    res.status(500).json({ error: "Failed to delete news item" });
  }
});

export default router;
