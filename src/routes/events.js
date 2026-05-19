import { Router } from "express";
import { db } from "../db/index.js";
import { events, rsvps, users, eventOrganizers } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { createNotification } from "../services/notificationService.js";

const router = Router();
const ADMIN_EMAIL = "andrew@mccreath.vip";

async function findUserByEmail(email) {
  const result = await db.select().from(users).where(eq(users.email, email));
  return result.length > 0 ? result[0] : null;
}

async function isEventAdmin(userId, eventId) {
  const result = await db.select().from(eventOrganizers).where(
    and(eq(eventOrganizers.userId, userId), eq(eventOrganizers.eventId, eventId), eq(eventOrganizers.role, "organizer"))
  );
  return result.length > 0;
}

router.get("/", async (req, res) => {
  try {
    const allEvents = await db.select().from(events);
    const eventsWithAttendees = await Promise.all(
      allEvents.map(async (event) => {
        const attendees = await db.select({ id: rsvps.id, userId: rsvps.userId, status: rsvps.status }).from(rsvps).where(eq(rsvps.eventId, event.id));
        return { ...event, attendees };
      })
    );
    res.json(eventsWithAttendees);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const event = await db.select().from(events).where(eq(events.id, req.params.id));
    if (event.length === 0) return res.status(404).json({ error: "Event not found" });
    const attendees = await db.select().from(rsvps).where(eq(rsvps.eventId, event[0].id));
    res.json({ ...event[0], attendees });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

router.post("/", authenticateToken, async (req, res) => {
  try {
    const { title, location, startDate, endDate, organiser, sponsors, description, organizerEmail } = req.body;
    const currentUser = await db.select().from(users).where(eq(users.id, req.userId));
    if (currentUser.length === 0 || currentUser[0].email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only admins can create events" });
    }
    const organizer = await findUserByEmail(organizerEmail);
    if (!organizer) {
      return res.status(400).json({ error: `Organizer user not found: ${organizerEmail}` });
    }
    const newEvent = await db.insert(events).values({
      title, location, startDate: new Date(startDate), endDate: new Date(endDate),
      organiser, eventUrl: sponsors, description, organizerEmail, status: "pending",
      createdAt: new Date(), updatedAt: new Date(),
    }).returning();
    const createdEvent = newEvent[0];
    await db.insert(eventOrganizers).values({ userId: organizer.id, eventId: createdEvent.id, role: "organizer" });
    await createNotification(organizer.id, createdEvent.id, "event_approval_request", { eventTitle: title, createdBy: currentUser[0].email });
    console.log("✓ Event created (pending approval):", createdEvent.id);
    res.status(201).json({ ...createdEvent, attendees: [], message: "Event created pending approval" });
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event", details: error.message });
  }
});

router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { title, location, startDate, endDate, organiser, sponsors, description, organizerEmail } = req.body;
    const eventId = req.params.id;
    const event = await db.select().from(events).where(eq(events.id, eventId));
    if (event.length === 0) return res.status(404).json({ error: "Event not found" });
    
    const currentUser = await db.select().from(users).where(eq(users.id, req.userId));
    const isAdmin = currentUser.length > 0 && currentUser[0].email === ADMIN_EMAIL;
    const isOrganizer = currentUser.length > 0 && currentUser[0].email === event[0].organizerEmail;
    
    if (!isAdmin && !isOrganizer) {
      return res.status(403).json({ error: "Only admins or organizers can edit events" });
    }

    const updated = await db.update(events).set({
      title, location, startDate: new Date(startDate), endDate: new Date(endDate),
      organiser, eventUrl: sponsors, description, organizerEmail,
      updatedAt: new Date(),
    }).where(eq(events.id, eventId)).returning();

    console.log("✓ Event updated:", eventId);
    res.json(updated[0]);
  } catch (error) {
    console.error("Failed to update event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

router.put("/:id/approve", authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const event = await db.select().from(events).where(eq(events.id, eventId));
    if (event.length === 0) return res.status(404).json({ error: "Event not found" });
    const isAdmin = await isEventAdmin(req.userId, eventId);
    if (!isAdmin) return res.status(403).json({ error: "Only event organizers can approve events" });
    const updatedEvent = await db.update(events).set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() }).where(eq(events.id, eventId)).returning();
    console.log("✅ Event approved:", eventId);
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Failed to approve event:", error);
    res.status(500).json({ error: "Failed to approve event" });
  }
});

router.put("/:id/reject", authenticateToken, async (req, res) => {
  try {
    const eventId = req.params.id;
    const { reason } = req.body;
    const event = await db.select().from(events).where(eq(events.id, eventId));
    if (event.length === 0) return res.status(404).json({ error: "Event not found" });
    const isAdmin = await isEventAdmin(req.userId, eventId);
    if (!isAdmin) return res.status(403).json({ error: "Only event organizers can reject events" });
    const updatedEvent = await db.update(events).set({ status: "rejected", updatedAt: new Date() }).where(eq(events.id, eventId)).returning();
    console.log("❌ Event rejected:", eventId);
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Failed to reject event:", error);
    res.status(500).json({ error: "Failed to reject event" });
  }
});

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const currentUser = await db.select().from(users).where(eq(users.id, req.userId));
    if (currentUser.length === 0 || currentUser[0].email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Only admins can delete events" });
    }
    await db.delete(events).where(eq(events.id, req.params.id));
    console.log("🗑️ Event deleted:", req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

router.post("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const eventId = req.params.id;
    const result = await db.insert(rsvps).values({ userId: req.userId, eventId, status: status || "interested" }).returning();
    console.log("✓ RSVP created:", result[0].id);
    res.status(201).json(result[0]);
  } catch (error) {
    if (error.message.includes("duplicate key")) {
      return res.status(400).json({ error: "Already RSVPed to this event" });
    }
    console.error("Failed to create RSVP:", error);
    res.status(500).json({ error: "Failed to create RSVP" });
  }
});

router.delete("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    await db.delete(rsvps).where(and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id)));
    console.log("✓ RSVP deleted");
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete RSVP:", error);
    res.status(500).json({ error: "Failed to delete RSVP" });
  }
});

export default router;
