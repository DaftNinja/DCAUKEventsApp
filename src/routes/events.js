import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps, users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GET all events
router.get("/", async (req, res) => {
  try {
    const allEvents = await db.select().from(events);
    
    // Attach attendee info
    const eventsWithAttendees = await Promise.all(
      allEvents.map(async (event) => {
        const attendees = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            status: rsvps.status,
          })
          .from(rsvps)
          .leftJoin(users, eq(rsvps.userId, users.id))
          .where(eq(rsvps.eventId, event.id));

        return { ...event, attendees };
      })
    );

    res.json(eventsWithAttendees);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// GET single event
router.get("/:id", async (req, res) => {
  try {
    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id));

    if (event.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    const attendees = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: rsvps.status,
      })
      .from(rsvps)
      .leftJoin(users, eq(rsvps.userId, users.id))
      .where(eq(rsvps.eventId, req.params.id));

    res.json({ ...event[0], attendees });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// POST create event (admin only)
router.post("/", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId));

    if (user.length === 0 || user[0].email !== "andrew@mccreath.vip") {
      return res.status(403).json({ error: "Only admins can create events" });
    }

    const {
      title,
      description,
      startDate,
      endDate,
      location,
      isVirtual,
      organiser,
      sponsors,
    } = req.body;

    if (!title || !startDate || !endDate || !location || !organiser) {
      return res.status(400).json({
        error: "Missing required fields: title, startDate, endDate, location, organiser",
      });
    }

    const newEvent = await db
      .insert(events)
      .values({
        id: uuidv4(),
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        location,
        isVirtual: isVirtual || false,
        organiser,
        eventUrl: sponsors || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✓ Event created:", newEvent[0].id);
    res.status(201).json(newEvent[0]);
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event", details: error.message });
  }
});

// DELETE event (admin only)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId));

    if (user.length === 0 || user[0].email !== "andrew@mccreath.vip") {
      return res.status(403).json({ error: "Only admins can delete events" });
    }

    // Delete RSVPs first
    await db.delete(rsvps).where(eq(rsvps.eventId, req.params.id));

    // Delete event
    await db.delete(events).where(eq(events.id, req.params.id));

    console.log("✓ Event deleted:", req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// POST RSVP to event
router.post("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    const { status = "going" } = req.body;
    const eventId = req.params.id;
    const userId = req.userId;

    // Check if event exists
    const event = await db
      .select()
      .from(events)
      .where(eq(events.id, eventId));

    if (event.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Check if already RSVPed
    const existing = await db
      .select()
      .from(rsvps)
      .where(eq(rsvps.eventId, eventId))
      .where(eq(rsvps.userId, userId));

    if (existing.length > 0) {
      // Update existing RSVP
      await db
        .update(rsvps)
        .set({ status })
        .where(eq(rsvps.eventId, eventId))
        .where(eq(rsvps.userId, userId));

      return res.json({ success: true, message: "RSVP updated" });
    }

    // Create new RSVP
    await db.insert(rsvps).values({
      id: uuidv4(),
      userId,
      eventId,
      status,
      createdAt: new Date(),
    });

    console.log("✓ RSVP created:", userId, eventId);
    res.status(201).json({ success: true, message: "RSVP created" });
  } catch (error) {
    console.error("Failed to RSVP:", error);
    res.status(500).json({ error: "Failed to RSVP to event" });
  }
});

// DELETE RSVP
router.delete("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const userId = req.userId;

    await db
      .delete(rsvps)
      .where(eq(rsvps.eventId, eventId))
      .where(eq(rsvps.userId, userId));

    console.log("✓ RSVP deleted:", userId, eventId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete RSVP:", error);
    res.status(500).json({ error: "Failed to unregister from event" });
  }
});

export default router;
