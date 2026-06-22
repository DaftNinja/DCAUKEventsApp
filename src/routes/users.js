import { Router } from "express";
import { db } from "../db/index.js";
import { users, rsvps, events } from "../db/schema.js";
import { eq, desc, ilike, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { validate, updateProfileSchema } from "../middleware/validate.js";
import { sendOrganiserRequest } from "../services/email.js";

const router = Router();

// ─── GET /api/users/me ────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select({
        id:                  users.id,
        name:                users.name,
        email:               users.email,
        headline:            users.headline,
        company:             users.company,
        avatarUrl:           users.avatarUrl,
        bio:                 users.bio,
        role:                users.role,
        status:              users.status,
        defaultOpenToMeeting: users.defaultOpenToMeeting,
        createdAt:           users.createdAt,
        updatedAt:           users.updatedAt,
      })
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

// ─── GET /api/users/:id ─────────────────────────────────────────────────────────────
// Public member profile — returns public fields only, plus their upcoming events
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const [member] = await db
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
      .where(and(eq(users.id, req.params.id), eq(users.status, "active")))
      .limit(1);

    if (!member) return res.status(404).json({ error: "Member not found" });

    // Fetch their upcoming Going RSVPs
    const now = new Date();
    const memberRsvps = await db
      .select({
        eventId:   events.id,
        title:     events.title,
        startDate: events.startDate,
        location:  events.location,
        status:    rsvps.status,
      })
      .from(rsvps)
      .innerJoin(events, eq(rsvps.eventId, events.id))
      .where(
        and(
          eq(rsvps.userId, req.params.id),
          eq(rsvps.status, "going"),
          eq(events.status, "approved")
        )
      )
      .orderBy(events.startDate);

    const upcomingEvents = memberRsvps.filter(e => new Date(e.startDate) >= now);

    res.json({ ...member, upcomingEvents });
  } catch (error) {
    console.error("Failed to fetch member:", error);
    res.status(500).json({ error: "Failed to fetch member" });
  }
});

// ─── POST /api/users/request-organiser ─────────────────────────────────────────
// Member requests organiser role — admin gets an email notification
router.post("/request-organiser", authenticateToken, async (req, res) => {
  try {
    const [requester] = await db
      .select({ id: users.id, name: users.name, email: users.email, headline: users.headline, company: users.company, role: users.role })
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!requester) return res.status(404).json({ error: "User not found" });
    if (requester.role !== "member") return res.status(400).json({ error: "Only members can request organiser access" });

    // Notify admin by email
    await sendOrganiserRequest({ requester });

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to send organiser request:", error);
    res.status(500).json({ error: "Failed to send request" });
  }
});

export default router;
