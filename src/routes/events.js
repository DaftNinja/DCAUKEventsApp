import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps, users } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireAdmin,
  fetchEvent,
  requireOwnerOrAdmin,
} from "../middleware/authorize.js";
import {
  validate,
  createEventSchema,
  updateEventSchema,
  rsvpSchema,
} from "../middleware/validate.js";
import {
  sendRsvpConfirmation,
  sendRsvpCancellation,
  sendNewEventNotification,
  sendEventApproved,
  sendEventRejected,
} from "../services/email.js";

const router = Router();

// ─── GET /api/events ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const jwt = (await import("jsonwebtoken")).default;
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch {
        // Invalid/expired token — treat as unauthenticated
      }
    }

    const allEvents = await db.select().from(events).orderBy(desc(events.featured), events.startDate);

    // Fetch all RSVP counts in a single query — no N+1
    const rsvpCounts = await db
      .select({
        eventId:       rsvps.eventId,
        status:        rsvps.status,
        count:         sql`count(*)`.mapWith(Number),
      })
      .from(rsvps)
      .groupBy(rsvps.eventId, rsvps.status);

    // Build map: eventId → { going, interested }
    const countMap = {};
    for (const row of rsvpCounts) {
      if (!countMap[row.eventId]) countMap[row.eventId] = { going: 0, interested: 0 };
      if (row.status === 'going')      countMap[row.eventId].going      = row.count;
      if (row.status === 'interested') countMap[row.eventId].interested = row.count;
    }

    if (userId) {
      // Single query for all RSVPs for this user — no N+1
      const userRsvps = await db
        .select()
        .from(rsvps)
        .where(eq(rsvps.userId, userId));

      const rsvpMap = Object.fromEntries(
        userRsvps.map((r) => [r.eventId, r.status])
      );

      return res.json(
        allEvents.map((e) => ({
          ...e,
          currentUserRsvp: rsvpMap[e.id] ?? null,
          goingCount:      countMap[e.id]?.going      ?? 0,
          interestedCount: countMap[e.id]?.interested ?? 0,
        }))
      );
    }

    res.json(allEvents.map((e) => ({
      ...e,
      currentUserRsvp: null,
      goingCount:      countMap[e.id]?.going      ?? 0,
      interestedCount: countMap[e.id]?.interested ?? 0,
    })));
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// ─── GET /api/events/:id ──────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!event) return res.status(404).json({ error: "Event not found" });

    const attendees = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.eventId, req.params.id));

    res.json({ ...event, attendees });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// ─── POST /api/events ─────────────────────────────────────────────────────────
router.post("/", authenticateToken, validate(createEventSchema), async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, eventUrl, capacity } =
      req.body;

    const [newEvent] = await db
      .insert(events)
      .values({
        title,
        description,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        location,
        eventUrl,
        capacity,
        organizerId: req.userId,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(newEvent);
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// ─── PUT /api/events/:id ──────────────────────────────────────────────────────
router.put("/:id", authenticateToken, fetchEvent, requireOwnerOrAdmin, validate(updateEventSchema), async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, eventUrl, capacity } =
      req.body;

    const [updated] = await db
      .update(events)
      .set({
        title,
        description,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        location,
        eventUrl,
        capacity,
        updatedAt: new Date(),
      })
      .where(eq(events.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Failed to update event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// ─── GET /api/events/:id/attendees/export ─────────────────────────────────────
// Admin/organiser only: download Going + Interested attendees as CSV
router.get("/:id/attendees/export", authenticateToken, async (req, res) => {
  try {
    const [event] = await db.select().from(events).where(eq(events.id, req.params.id)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });

    // Only admin or the event organiser can export
    const [requestingUser] = await db.select({ role: users.role, id: users.id })
      .from(users).where(eq(users.id, req.userId)).limit(1);
    const isAdmin     = requestingUser?.role === "admin";
    const isOrganiser = event.organizerId === req.userId;
    if (!isAdmin && !isOrganiser) {
      return res.status(403).json({ error: "Not authorised" });
    }

    const attendees = await db
      .select({
        name:      users.name,
        email:     users.email,
        headline:  users.headline,
        company:   users.company,
        status:    rsvps.status,
        rsvpdAt:   rsvps.createdAt,
      })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(eq(rsvps.eventId, req.params.id))
      .orderBy(rsvps.status, users.name);

    // Build CSV
    const header = "Name,Email,Headline,Company,Status,RSVP Date";
    const rows = attendees.map(a => [
      `"${(a.name     || '').replace(/"/g, '""')}"`,
      `"${(a.email    || '').replace(/"/g, '""')}"`,
      `"${(a.headline || '').replace(/"/g, '""')}"`,
      `"${(a.company  || '').replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${a.rsvpdAt ? new Date(a.rsvpdAt).toLocaleDateString('en-GB') : ''}"`,
    ].join(','));

    const csv = [header, ...rows].join('\n');
    const filename = `${event.title.replace(/[^a-z0-9]/gi, '_')}_attendees.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Failed to export attendees:", error);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── POST /api/events/:id/feature ───────────────────────────────────────────
router.post("/:id/feature", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [current] = await db.select({ featured: events.featured }).from(events).where(eq(events.id, req.params.id)).limit(1);
    if (!current) return res.status(404).json({ error: "Event not found" });
    const [updated] = await db
      .update(events)
      .set({ featured: !current.featured, updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();
    res.json(updated);
  } catch (error) {
    console.error("Failed to toggle featured:", error);
    res.status(500).json({ error: "Failed to toggle featured" });
  }
});

// ─── POST /api/events/:id/approve ────────────────────────────────────────────
router.post("/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });

    // Notify all members about the new event
    try {
      const allUsers = await db.select({ email: users.email }).from(users);
      await sendNewEventNotification({ event: updated, recipients: allUsers });
    } catch (emailErr) {
      console.error("Failed to send new event notification:", emailErr);
    }

    // Notify the organiser their event was approved
    try {
      await sendEventApproved({ event: updated });
    } catch (emailErr) {
      console.error("Failed to send approval email to organiser:", emailErr);
    }

    res.json(updated);
  } catch (error) {
    console.error("Failed to approve event:", error);
    res.status(500).json({ error: "Failed to approve event" });
  }
});

// ─── POST /api/events/:id/reject ─────────────────────────────────────────────
router.post("/:id/reject", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });

    // Notify the organiser their event was rejected
    try {
      await sendEventRejected({ event: updated });
    } catch (emailErr) {
      console.error("Failed to send rejection email to organiser:", emailErr);
    }

    res.json(updated);
  } catch (error) {
    console.error("Failed to reject event:", error);
    res.status(500).json({ error: "Failed to reject event" });
  }
});

// ─── DELETE /api/events/:id ───────────────────────────────────────────────────
router.delete("/:id", authenticateToken, fetchEvent, requireOwnerOrAdmin, async (req, res) => {
  try {
    await db.delete(rsvps).where(eq(rsvps.eventId, req.params.id));
    await db.delete(events).where(eq(events.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ─── POST /api/events/:id/rsvp ────────────────────────────────────────────────
router.post("/:id/rsvp", authenticateToken, validate(rsvpSchema), async (req, res) => {
  try {
    const { status } = req.body;
    const eventId = req.params.id;

    const [rsvp] = await db
      .insert(rsvps)
      .values({
        userId: req.userId,
        eventId,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [rsvps.userId, rsvps.eventId],
        set: { status, updatedAt: new Date() },
      })
      .returning();

    // Send confirmation email — fire and forget, don't block the response
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (user && event) {
        await sendRsvpConfirmation({ user, event, status });
      }
    } catch (emailErr) {
      console.error("Failed to send RSVP confirmation email:", emailErr);
    }

    res.json(rsvp);
  } catch (error) {
    console.error("Failed to RSVP:", error);
    res.status(500).json({ error: "Failed to RSVP" });
  }
});

// ─── DELETE /api/events/:id/rsvp ─────────────────────────────────────────────
router.delete("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    // Get event details before deleting for the cancellation email
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    await db
      .delete(rsvps)
      .where(
        and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id))
      );

    // Send cancellation email
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (user && event) {
        await sendRsvpCancellation({ user, event });
      }
    } catch (emailErr) {
      console.error("Failed to send RSVP cancellation email:", emailErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to remove RSVP:", error);
    res.status(500).json({ error: "Failed to remove RSVP" });
  }
});

// ─── PUT /api/events/:id/rsvp/meeting ────────────────────────────────────────────
router.put("/:id/rsvp/meeting", authenticateToken, async (req, res) => {
  try {
    const { openToMeeting } = req.body;

    const [rsvp] = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id)))
      .limit(1);

    if (!rsvp) return res.status(404).json({ error: "You have no RSVP for this event" });
    if (rsvp.status !== "going") return res.status(400).json({ error: "Meet-Me is only available when you are Going" });

    const [updated] = await db
      .update(rsvps)
      .set({ openToMeeting: Boolean(openToMeeting), updatedAt: new Date() })
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id)))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error("Failed to update meet-me status:", error);
    res.status(500).json({ error: "Failed to update meet-me status" });
  }
});

// ─── GET /api/events/:id/meeting ──────────────────────────────────────────────────
router.get("/:id/meeting", authenticateToken, async (req, res) => {
  try {
    const [myRsvp] = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id)))
      .limit(1);

    if (!myRsvp || myRsvp.status !== "going") {
      return res.status(403).json({ error: "Only Going attendees can view Meet-Me profiles" });
    }

    const attendees = await db
      .select({
        id:            users.id,
        name:          users.name,
        headline:      users.headline,
        company:       users.company,
        avatarUrl:     users.avatarUrl,
        linkedinId:    users.linkedinId,
        openToMeeting: rsvps.openToMeeting,
      })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(
        and(
          eq(rsvps.eventId, req.params.id),
          eq(rsvps.status, "going"),
          eq(rsvps.openToMeeting, true),
          eq(users.status, "active")
        )
      );

    res.json(attendees);
  } catch (error) {
    console.error("Failed to fetch meeting attendees:", error);
    res.status(500).json({ error: "Failed to fetch meeting attendees" });
  }
});

export default router;
