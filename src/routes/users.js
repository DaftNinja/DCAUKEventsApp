import { Router } from "express";
import { db } from "../db/index.js";
import { users, rsvps, events } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

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
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const { name, headline, company, bio, avatarUrl, defaultOpenToMeeting } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        ...(name                 !== undefined && { name }),
        ...(headline             !== undefined && { headline }),
        ...(company              !== undefined && { company }),
        ...(bio                  !== undefined && { bio }),
        ...(avatarUrl            !== undefined && { avatarUrl }),
        ...(defaultOpenToMeeting !== undefined && { defaultOpenToMeeting }),
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
// Member directory — public fields only, never exposes email or linkedinId
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

    const userRsvps = await db
      .select({ userId: rsvps.userId })
      .from(rsvps)
      .where(eq(rsvps.status, "going"));

    const rsvpCounts = userRsvps.reduce((acc, r) => {
      acc[r.userId] = (acc[r.userId] || 0) + 1;
      return acc;
    }, {});

    res.json(allUsers.map(u => ({
      ...u,
      eventsAttending: rsvpCounts[u.id] || 0,
    })));
  } catch (error) {
    console.error("Failed to fetch members:", error);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

export default router;
