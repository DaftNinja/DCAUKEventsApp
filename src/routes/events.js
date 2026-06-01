import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
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

    const eventRsvps = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.eventId, req.params.id));

    res.json({ ...event, attendees: eventRsvps });
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

// ─── POST /api/events/:id/approve ────────────────────────────────────────────
router.post("/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });
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
        set: {
          status,
          updatedAt: new Date(),
        },
      })
      .returning();

    res.json(rsvp);
  } catch (error) {
    console.error("Failed to RSVP:", error);
    res.status(500).json({ error: "Failed to RSVP" });
  }
});

// ─── DELETE /api/events/:id/rsvp ─────────────────────────────────────────────
router.delete("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    await db
      .delete(rsvps)
      .where(
        and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id))
      );
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to remove RSVP:", error);
    res.status(500).json({ error: "Failed to remove RSVP" });
  }
});

export default router;
