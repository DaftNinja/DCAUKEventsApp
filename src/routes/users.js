import { Router } from "express";
import { db } from "../db/index.js";
import { users, rsvps, events } from "../db/schema.js";
import { eq, desc, ilike, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { validate, updateProfileSchema } from "../middleware/validate.js";

const router = Router();

// ─── GET /api/users/me ────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
router.put("/me", authenticateToken, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name, headline, company, bio, avatarUrl } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        ...(name      !== undefined && { name }),
        ...(headline  !== undefined && { headline }),
        ...(company   !== undefined && { company }),
        ...(bio       !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId))
      .returning();

    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ─── GET /api/users ───────────────────────────────────────────────────────────
// Member directory — returns all members with public fields only.
// Never exposes email, linkedinId, or internal timestamps.
router.get("/", authenticateToken, async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id:        users.id,
        name:      users.name,
        headline:  users.headline,
        company:   users.company,
        avatarUrl: users.avatarUrl,
        bio:       users.bio,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // For each user, get their upcoming RSVP count (going only) as a
    // lightweight engagement signal — no personal data exposed
    const now = new Date();
    const userRsvps = await db
      .select({
        userId:  rsvps.userId,
        eventId: rsvps.eventId,
        status:  rsvps.status,
      })
      .from(rsvps)
      .leftJoin(events, eq(rsvps.eventId, events.id))
      .where(eq(rsvps.status, "going"));

    // Build a count map: userId → number of "going" RSVPs
    const rsvpCounts = userRsvps.reduce((acc, r) => {
      acc[r.userId] = (acc[r.userId] || 0) + 1;
      return acc;
    }, {});

    const members = allUsers.map((u) => ({
      ...u,
      eventsAttending: rsvpCounts[u.id] || 0,
    }));

    res.json(members);
  } catch (error) {
    console.error("Failed to fetch members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// ─── GET /api/users/search?q= ─────────────────────────────────────────────────────
// Returns up to 8 members whose name starts with the query — for @mention autocomplete
router.get("/search", authenticateToken, async (req, res) => {
  const q = (req.query.q || "").trim();
  if (q.length < 1) return res.json([]);
  try {
    const results = await db
      .select({
        id:        users.id,
        name:      users.name,
        headline:  users.headline,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        and(
          ilike(users.name, `${q}%`),
          eq(users.status, "active")
        )
      )
      .limit(8);
    res.json(results);
  } catch (error) {
    console.error("Failed to search users:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
