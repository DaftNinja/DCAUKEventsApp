import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps, users } from "../db/schema.js";
import { eq, gte, lte, desc, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Get all events with optional filters
router.get("/", async (req, res) => {
  try {
    const { startDate, endDate, organiser } = req.query;

    let query = db.select().from(events);
    const conditions = [];

    if (startDate) {
      conditions.push(gte(events.startDate, new Date(startDate)));
    }
    if (endDate) {
      conditions.push(lte(events.startDate, new Date(endDate)));
    }
    if (organiser) {
      conditions.push(eq(events.organiser, organiser));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const allEvents = await query.orderBy(events.startDate);
    res.json(allEvents);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// Get single event with attendee list
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get event
    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, id));

    if (!event.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Get attendees
    const attendees = await db
      .select({
        id: users.id,
        name: users.name,
        headline: users.headline,
        company: users.company,
        avatarUrl: users.avatarUrl,
        rsvpStatus: rsvps.status,
      })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(eq(rsvps.eventId, id));

    res.json({
      ...event[0],
      attendees,
      attendeeCount: attendees.length,
    });
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// RSVP to event (create or update)
router.post("/:id/rsvp", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'interested' or 'going'

    if (!["interested", "going"].includes(status)) {
      return res.status(400).json({ error: "Invalid RSVP status" });
    }

    // Check if event exists
    const event = await db.select().from(events).where(eq(events.id, id));
    if (!event.length) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if RSVP already exists
    const existingRsvp = await db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, id)));

    if (existingRsvp.length > 0) {
      // Update existing
      await db
        .update(rsvps)
        .set({ status })
        .where(eq(rsvps.id, existingRsvp[0].id));
    } else {
      // Create new
      await db.insert(rsvps).values({
        userId: req.userId,
        eventId: id,
        status,
      });
    }

    res.json({ success: true, status });
  } catch (error) {
    console.error("Error creating RSVP:", error);
    res.status(500).json({ error: "Failed to RSVP" });
  }
});

// Remove RSVP
router.delete("/:id/rsvp", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    await db
      .delete(rsvps)
      .where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, id)));

    res.json({ success: true });
  } catch (error) {
    console.error("Error removing RSVP:", error);
    res.status(500).json({ error: "Failed to remove RSVP" });
  }
});

export default router;
