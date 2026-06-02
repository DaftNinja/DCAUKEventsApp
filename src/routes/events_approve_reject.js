// ── In src/routes/events.js, update the import line for email.js ──
// Change:
import {
  sendRsvpConfirmation,
  sendRsvpCancellation,
  sendNewEventNotification,
} from "../services/email.js";

// To:
import {
  sendRsvpConfirmation,
  sendRsvpCancellation,
  sendNewEventNotification,
  sendEventApproved,
  sendEventRejected,
} from "../services/email.js";


// ── Then replace the approve route handler ──

router.post("/:id/approve", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });

    // Email organiser that their event was approved
    try {
      await sendEventApproved({ event: updated });
    } catch (emailErr) {
      console.error("Failed to send approval email to organiser:", emailErr);
    }

    // Notify all members about the new event
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


// ── And replace the reject route handler ──

router.post("/:id/reject", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const [updated] = await db
      .update(events)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(events.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });

    // Email organiser that their event was rejected
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
