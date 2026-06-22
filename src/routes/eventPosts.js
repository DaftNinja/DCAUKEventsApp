import { Router } from "express";
import { db } from "../db/index.js";
import { eventPosts, rsvps, users } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { attachUser } from "../middleware/authorize.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";

const router = Router({ mergeParams: true }); // inherits :id from events route

const createPostSchema = z.object({
  content: z.string().min(1).max(2000),
  linkUrl: z.string().url().optional().or(z.literal("")),
});

// ─── GET /api/events/:id/posts ────────────────────────────────────────────────
// Visible to all logged-in members
router.get("/", authenticateToken, async (req, res) => {
  try {
    const posts = await db
      .select({
        id:        eventPosts.id,
        content:   eventPosts.content,
        linkUrl:   eventPosts.linkUrl,
        createdAt: eventPosts.createdAt,
        updatedAt: eventPosts.updatedAt,
        author: {
          id:        users.id,
          name:      users.name,
          headline:  users.headline,
          company:   users.company,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(eventPosts)
      .innerJoin(users, eq(eventPosts.userId, users.id))
      .where(eq(eventPosts.eventId, req.params.id))
      .orderBy(desc(eventPosts.createdAt))
      .limit(100);

    res.json(posts);
  } catch (error) {
    console.error("Failed to fetch event posts:", error);
    res.status(500).json({ error: "Failed to fetch event posts" });
  }
});

// ─── POST /api/events/:id/posts ───────────────────────────────────────────────
// Only Going or Interested attendees can post
router.post("/", authenticateToken, validate(createPostSchema), async (req, res) => {
  try {
    // Check the user has RSVPd Going or Interested
    const [rsvp] = await db
      .select()
      .from(rsvps)
      .where(
        and(
          eq(rsvps.userId, req.userId),
          eq(rsvps.eventId, req.params.id)
        )
      )
      .limit(1);

    if (!rsvp || !["going", "interested"].includes(rsvp.status)) {
      return res.status(403).json({
        error: "You must be Going or Interested to post in this forum",
      });
    }

    const { content, linkUrl } = req.body;

    const [post] = await db
      .insert(eventPosts)
      .values({
        eventId:  req.params.id,
        userId:   req.userId,
        content,
        linkUrl:  linkUrl || null,
      })
      .returning();

    // Return post with author info
    const [author] = await db
      .select({
        id:        users.id,
        name:      users.name,
        headline:  users.headline,
        company:   users.company,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    res.status(201).json({ ...post, author });
  } catch (error) {
    console.error("Failed to create event post:", error);
    res.status(500).json({ error: "Failed to create event post" });
  }
});

// ─── DELETE /api/events/:id/posts/:postId ─────────────────────────────────────
// Owner or admin only
router.delete("/:postId", authenticateToken, attachUser, async (req, res) => {
  try {
    const [post] = await db
      .select()
      .from(eventPosts)
      .where(eq(eventPosts.id, req.params.postId))
      .limit(1);

    if (!post) return res.status(404).json({ error: "Post not found" });

    const isOwner = post.userId === req.userId;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Not allowed" });
    }

    await db.delete(eventPosts).where(eq(eventPosts.id, req.params.postId));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event post:", error);
    res.status(500).json({ error: "Failed to delete event post" });
  }
});

export default router;
