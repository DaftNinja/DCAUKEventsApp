// ── Replace the POST /api/events handler in src/routes/events.js ──
// Also add attachUser to the import from authorize.js:
//
// import {
//   requireAdmin,
//   fetchEvent,
//   requireOwnerOrAdmin,
//   attachUser,
//   isOrganiserOrAdmin,
// } from "../middleware/authorize.js";

router.post("/", authenticateToken, attachUser, validate(createEventSchema), async (req, res) => {
  try {
    const {
      title, description, startDate, endDate,
      location, eventUrl, capacity, organiser, organizerEmail
    } = req.body;

    // Organisers and admins skip the queue — their events go straight to approved
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

    // If auto-approved, notify all members immediately
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
