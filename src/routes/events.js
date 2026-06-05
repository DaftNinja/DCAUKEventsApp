import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps, users } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireAdmin,
  fetchEvent,
  requireOwnerOrAdmin,
  attachUser,
  isOrganiserOrAdmin,
} from "../middleware/authorize.js";
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

    const allEvents = await db.select().from(events).orderBy(events.startDate);

    if (userId) {
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
        }))
      );
    }

    res.json(allEvents.map((e) => ({ ...e, currentUserRsvp: null })));
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
router.post("/", authenticateToken, attachUser, async (req, res) => {
  try {
    const {
      title, description, startDate, endDate,
      location, eventUrl, capacity, organiser, organizerEmail
    } = req.body;

    const autoApprove = isOrganiserOrAdmin(req.user);

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
        organiser,
        organizerEmail,
        organizerId: req.userId,
        status: autoApprove ? "approved" : "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (autoApprove) {
      try {
        const allUsers = await db.select({ email: users.email }).from(users);
        await sendNewEventNotification({ event: newEvent, recipients: allUsers });
      } catch (emailErr) {
        console.error("Failed to send new event notification:", emailErr);
      }
    }

    res.status(201).json(newEvent);
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// ─── PUT /api/events/:id ──────────────────────────────────────────────────────
router.put("/:id", authenticateToken, fetchEvent, requireOwnerOrAdmin, async (req, res) => {
  try {
    const { title, description, startDate, endDate, location, eventUrl, capacity } = req.body;

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

// ─── POST /api/events/:id/approve ────────────────────────────────────────────
router.post("/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });

    try {
      await sendEventApproved({ event: updated });
    } catch (emailErr) {
      console.error("Failed to send approval email:", emailErr);
    }

    try {
      const allUsers = await db.select({ email: users.email }).from(users);
      await sendNewEventNotification({ event: updated, recipients: allUsers });
    } catch (emailErr) {
      console.error("Failed to send new event notification:", emailErr);
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

    try {
      await sendEventRejected({ event: updated });
    } catch (emailErr) {
      console.error("Failed to send rejection email:", emailErr);
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
router.post("/:id/rsvp", authenticateToken, async (req, res) => {
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

    try {
      const [user]  = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
      if (user && event) await sendRsvpConfirmation({ user, event, status });
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
    const [event] = await db.select().from(events).where(eq(events.id, req.params.id)).limit(1);

    await db
      .delete(rsvps)
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id)));

    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.userId)).limit(1);
      if (user && event) await sendRsvpCancellation({ user, event });
    } catch (emailErr) {
      console.error("Failed to send RSVP cancellation email:", emailErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to remove RSVP:", error);
    res.status(500).json({ error: "Failed to remove RSVP" });
  }
});

// ─── PUT /api/events/:id/rsvp/meeting ────────────────────────────────────────
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

// ─── GET /api/events/:id/meeting ─────────────────────────────────────────────
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
        id:           users.id,
        name:         users.name,
        headline:     users.headline,
        company:      users.company,
        avatarUrl:    users.avatarUrl,
        linkedinId:   users.linkedinId,
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
