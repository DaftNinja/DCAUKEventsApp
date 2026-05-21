import { Router } from "express";
import { db } from "../db/index.js";
import { users, events, rsvps } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
console.log("📧 Resend initialized with key:", process.env.RESEND_API_KEY ? "✓ Set" : "✗ Missing");

const router = Router();

// GET all events
router.get("/", async (req, res) => {
  try {
    const allEvents = await db.select().from(events);
    const eventsWithAttendees = await Promise.all(
      allEvents.map(async (event) => {
        const attendees = await db
          .select()
          .from(rsvps)
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
      .select()
      .from(rsvps)
      .where(eq(rsvps.eventId, event[0].id));

    res.json({ ...event[0], attendees });
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Failed to fetch event" });
  }
});

// POST create event
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { title, location, startDate, endDate, organiser, sponsors, description, organizerEmail } = req.body;

    const newEvent = await db
      .insert(events)
      .values({
        title,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        organiser,
        eventUrl: sponsors,
        description,
        organizerEmail,
        status: "pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    console.log("✓ Event created (pending approval):", newEvent[0].id);
    res.status(201).json({ ...newEvent[0], attendees: [] });
  } catch (error) {
    console.error("Failed to create event:", error);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// PUT update event
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { title, location, startDate, endDate, organiser, sponsors, description, organizerEmail } = req.body;

    const updatedEvent = await db
      .update(events)
      .set({
        title,
        location,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        organiser,
        eventUrl: sponsors,
        description,
        organizerEmail,
        updatedAt: new Date(),
      })
      .where(eq(events.id, req.params.id))
      .returning();

    if (updatedEvent.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    console.log("✏️ Event updated:", req.params.id);
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Failed to update event:", error);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// PUT approve event
router.put("/:id/approve", authenticateToken, async (req, res) => {
  try {
    const updatedEvent = await db
      .update(events)
      .set({
        status: "approved",
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(events.id, req.params.id))
      .returning();

    if (updatedEvent.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    console.log("✅ Event approved:", req.params.id);
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Failed to approve event:", error);
    res.status(500).json({ error: "Failed to approve event" });
  }
});

// PUT reject event
router.put("/:id/reject", authenticateToken, async (req, res) => {
  try {
    const updatedEvent = await db
      .update(events)
      .set({
        status: "rejected",
        updatedAt: new Date(),
      })
      .where(eq(events.id, req.params.id))
      .returning();

    if (updatedEvent.length === 0) {
      return res.status(404).json({ error: "Event not found" });
    }

    console.log("❌ Event rejected:", req.params.id);
    res.json(updatedEvent[0]);
  } catch (error) {
    console.error("Failed to reject event:", error);
    res.status(500).json({ error: "Failed to reject event" });
  }
});

// DELETE event
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    await db.delete(events).where(eq(events.id, req.params.id));
    console.log("🗑️ Event deleted:", req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete event:", error);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// POST RSVP to event
router.post("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Create RSVP
    const result = await db
      .insert(rsvps)
      .values({
        userId: req.userId,
        eventId: req.params.id,
        status: status || "interested",
      })
      .returning();
    
    console.log("✓ RSVP created:", result[0].id);

    // Send emails
    console.log("📧 Attempting to send emails...");
	try {
      // Get user and event details
      const user = await db.select().from(users).where(eq(users.id, req.userId));
      const event = await db.select().from(events).where(eq(events.id, req.params.id));
      
      if (user.length > 0 && event.length > 0) {
        const userData = user[0];
        const eventData = event[0];

        // Email to user
        await resend.emails.send({
          from: "events@dca.community",
          to: userData.email,
          subject: `You registered for ${eventData.title}`,
          html: `<h2>Registration Confirmed</h2>
            <p>Hi ${userData.name},</p>
            <p>You've registered as <strong>${status || "interested"}</strong> for:</p>
            <h3>${eventData.title}</h3>
            <p><strong>Date:</strong> ${new Date(eventData.startDate).toLocaleDateString()}</p>
            <p><strong>Location:</strong> ${eventData.location}</p>
            <p><strong>Organizer:</strong> ${eventData.organiser}</p>
            <p>See you there!</p>`
        });

        // Email to organizer
        if (eventData.organizerEmail) {
          await resend.emails.send({
            from: "events@dca.community",
            to: eventData.organizerEmail,
            subject: `New registration for ${eventData.title}`,
            html: `<h2>New Registration</h2>
              <p>${userData.name} (${userData.email}) registered as <strong>${status || "interested"}</strong> for your event:</p>
              <h3>${eventData.title}</h3>
              <p><strong>Date:</strong> ${new Date(eventData.startDate).toLocaleDateString()}</p>
              <p><strong>Company:</strong> ${userData.company || "Not specified"}</p>`
          });
        }
      }
    } catch (emailError) {
  console.error("❌ Email error:", emailError);
  // Don't fail the RSVP if email fails
}

    res.status(201).json(result[0]);
  } catch (error) {
    if (error.message.includes("duplicate key")) {
      return res.status(400).json({ error: "Already RSVPed to this event" });
    }
    console.error("Failed to create RSVP:", error);
    res.status(500).json({ error: "Failed to create RSVP" });
  }
});

// DELETE RSVP from event
router.delete("/:id/rsvp", authenticateToken, async (req, res) => {
  try {
    await db
      .delete(rsvps)
      .where(
        and(eq(rsvps.userId, req.userId), eq(rsvps.eventId, req.params.id))
      );

    console.log("✓ RSVP deleted");
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete RSVP:", error);
    res.status(500).json({ error: "Failed to delete RSVP" });
  }
});

export default router;