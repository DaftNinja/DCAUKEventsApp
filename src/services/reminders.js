import { db } from "../db/index.js";
import { events, rsvps, users } from "../db/schema.js";
import { eq, and, gte, lte } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = process.env.EMAIL_FROM || "theventguide.com <hello@theventguide.com>";
const SITE_URL = process.env.FRONTEND_URL || "https://dcaevents-production.up.railway.app";

function formatEventDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function formatEventTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });
}

function baseTemplate(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; }
    .wrapper { max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; }
    .logo { color: white; font-size: 20px; font-weight: 700; }
    .logo span { color: #06b6d4; }
    .body { padding: 32px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #1e293b; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 16px; }
    .event-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .event-title { font-size: 17px; font-weight: 600; color: #1e293b; margin: 0 0 8px; }
    .event-meta { font-size: 13px; color: #64748b; margin: 4px 0; }
    .countdown { display: inline-block; background: #fef3c7; color: #92400e; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .btn { display: inline-block; background: #06b6d4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header"><div class="logo">theventguide.com</div></div>
    <div class="body">${content}</div>
    <div class="footer">
      theventguide.com · <a href="${SITE_URL}" style="color:#06b6d4;">theventguide.com</a><br/>
      You're receiving this because you RSVPd as Going to this event.
    </div>
  </div>
</body>
</html>`;
}

/**
 * sendEventReminders — finds all events starting in the next 48–49 hours
 * and emails everyone who RSVPd as "going". Runs hourly via the scheduler.
 */
export async function sendEventReminders() {
  if (!process.env.RESEND_API_KEY) return;

  const now       = new Date();
  const in48hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in49hours = new Date(now.getTime() + 49 * 60 * 60 * 1000);

  const upcomingEvents = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.status, "approved"),
        gte(events.startDate, in48hours),
        lte(events.startDate, in49hours)
      )
    );

  if (upcomingEvents.length === 0) return;

  console.log(`📧 Sending reminders for ${upcomingEvents.length} event(s)`);

  for (const event of upcomingEvents) {
    const attendees = await db
      .select({ name: users.name, email: users.email })
      .from(rsvps)
      .innerJoin(users, eq(rsvps.userId, users.id))
      .where(
        and(
          eq(rsvps.eventId, event.id),
          eq(rsvps.status, "going"),
          eq(users.status, "active")
        )
      );

    if (attendees.length === 0) continue;

    const content = `
      <h1>Your event is tomorrow! 🗓️</h1>
      <p>Just a reminder that you're registered as <strong>Going</strong> to the following event:</p>
      <span class="countdown">⏰ In 48 hours</span>
      <div class="event-card">
        <div class="event-title">${event.title}</div>
        ${event.organiser ? `<div class="event-meta">🏢 ${event.organiser}</div>` : ""}
        <div class="event-meta">📅 ${formatEventDate(event.startDate)} at ${formatEventTime(event.startDate)}</div>
        ${event.location ? `<div class="event-meta">📍 ${event.location}</div>` : ""}
      </div>
      ${event.eventUrl ? `<p><a href="${event.eventUrl}" style="color:#06b6d4;">View on event website →</a></p>` : ""}
      <a href="${SITE_URL}/events/${event.id}" class="btn">View event details</a>
    `;

    const BATCH_SIZE = 50;
    for (let i = 0; i < attendees.length; i += BATCH_SIZE) {
      const batch = attendees.slice(i, i + BATCH_SIZE);
      try {
        await resend.emails.send({
          from:    FROM_ADDRESS,
          to:      FROM_ADDRESS,
          bcc:     batch.map(a => a.email),
          subject: `Reminder: ${event.title} is tomorrow`,
          html:    baseTemplate(content),
        });
      } catch (err) {
        console.error(`Failed to send reminder batch for event ${event.id}:`, err.message);
      }
    }

    console.log(`✓ Reminders sent for "${event.title}" to ${attendees.length} attendee(s)`);
  }
}
