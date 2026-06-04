import { Router } from "express";
import { db } from "../db/index.js";
import { newsItems } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
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
router.get("/", async (req, res) => {
  try {
    const items = await db
      .select()
      .from(newsItems)
      .orderBy(desc(newsItems.publishedAt))
      .limit(40);

    res.json(items);
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
