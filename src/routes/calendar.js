import { Router } from "express";
import { db } from "../db/index.js";
import { userPreferences, events } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

function formatIcsDate(date) {
  return new Date(date).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcs(str) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// ─── GET /api/calendar/subscribe/:token ───────────────────────────────────────
// Public ICS feed — no auth, identified by token
router.get("/subscribe/:token", async (req, res) => {
  try {
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.calToken, req.params.token))
      .limit(1);

    if (!prefs) return res.status(404).send("Calendar not found");

    // Parse filters
    const keywords  = (prefs.keywords  || "").split(",").map(k => k.trim().toLowerCase()).filter(Boolean);
    const locations = (prefs.locations || "").split(",").map(l => l.trim().toLowerCase()).filter(Boolean);

    // Fetch all approved events
    const allEvents = await db
      .select()
      .from(events)
      .where(eq(events.status, "approved"))
      .orderBy(events.startDate);

    // Filter to matching events — if no filters set, return all events
    const matched = allEvents.filter(e => {
      const text = `${e.title} ${e.description || ""} ${e.organiser || ""}`.toLowerCase();
      const loc  = (e.location || "").toLowerCase();
      const keywordMatch  = keywords.length  === 0 || keywords.some(k  => text.includes(k));
      const locationMatch = locations.length === 0 || locations.some(l  => loc.includes(l));
      return keywordMatch && locationMatch;
    });

    const siteUrl = process.env.FRONTEND_URL || "https://teg.1giglabs.com";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//theventguide.com//Events//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:theventguide.com Events",
      "X-WR-CALDESC:Personalised event feed from theventguide.com",
      "X-WR-TIMEZONE:UTC",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    ];

    for (const event of matched) {
      const start = formatIcsDate(event.startDate);
      const end   = formatIcsDate(event.endDate || event.startDate);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}@theventguide.com`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${escapeIcs(event.title)}`,
        `DESCRIPTION:${escapeIcs(event.description)}`,
        `LOCATION:${escapeIcs(event.location)}`,
        `URL:${siteUrl}/events/${event.id}`,
        `ORGANIZER;CN="${escapeIcs(event.organiser || "theventguide.com")}":MAILTO:hello@theventguide.com`,
        "END:VEVENT"
      );
    }

    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "inline; filename=theventguide.ics");
    res.setHeader("Cache-Control", "no-cache");
    res.send(lines.join("\r\n"));
  } catch (error) {
    console.error("Failed to serve calendar:", error);
    res.status(500).send("Calendar error");
  }
});

export default router;
