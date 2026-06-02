import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// The "from" address must be a verified domain in your Resend account.
// Update this once you've verified dcauk.org or 1giglabs.com in Resend.
// For now it uses Resend's shared domain for testing.
const FROM_ADDRESS = process.env.EMAIL_FROM || "DCAUK <onboarding@resend.dev>";
const SITE_URL = process.env.FRONTEND_URL || "https://dcaevents-production.up.railway.app";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function baseTemplate(content) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; }
    .wrapper { max-width: 560px; margin: 40px auto; background: white; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0f172a; padding: 24px 32px; }
    .logo { color: white; font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
    .logo span { color: #06b6d4; }
    .body { padding: 32px; }
    .footer { padding: 20px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #1e293b; }
    p { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 16px; }
    .event-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .event-title { font-size: 17px; font-weight: 600; color: #1e293b; margin: 0 0 8px; }
    .event-meta { font-size: 13px; color: #64748b; margin: 4px 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; margin-bottom: 16px; }
    .badge-going { background: #d1fae5; color: #065f46; }
    .badge-interested { background: #fef3c7; color: #92400e; }
    .btn { display: inline-block; background: #06b6d4; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 8px; }
    .divider { height: 1px; background: #e2e8f0; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">DCA<span>UK</span></div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      Digital Infrastructure Community · <a href="${SITE_URL}" style="color:#06b6d4;">dcauk.org</a><br/>
      You're receiving this because you're a member of DCAUK Events.
    </div>
  </div>
</body>
</html>`;
}

// ─── Email senders ────────────────────────────────────────────────────────────

/**
 * Sent to the user when they RSVP to an event.
 */
export async function sendRsvpConfirmation({ user, event, status }) {
  if (!process.env.RESEND_API_KEY) return;

  const isGoing = status === "going";
  const badgeClass = isGoing ? "badge-going" : "badge-interested";
  const badgeText = isGoing ? "✓ Going" : "★ Interested";
  const subject = isGoing
    ? `You're going to ${event.title}`
    : `You're interested in ${event.title}`;

  const content = `
    <h1>${isGoing ? "You're registered!" : "Marked as interested"}</h1>
    <p>Hi ${user.name || "there"},</p>
    <p>${isGoing
      ? "You've registered as <strong>Going</strong> for the following event:"
      : "You've marked yourself as <strong>Interested</strong> in the following event:"
    }</p>
    <span class="badge ${badgeClass}">${badgeText}</span>
    <div class="event-card">
      <div class="event-title">${event.title}</div>
      ${event.organiser ? `<div class="event-meta">🏢 ${event.organiser}</div>` : ""}
      <div class="event-meta">📅 ${formatEventDate(event.startDate)}</div>
      ${event.location ? `<div class="event-meta">📍 ${event.location}</div>` : ""}
    </div>
    ${event.eventUrl ? `<p><a href="${event.eventUrl}" style="color:#06b6d4;">View on event website →</a></p>` : ""}
    <div class="divider"></div>
    <p style="font-size:13px;color:#94a3b8;">You can update or remove your RSVP at any time from the event page.</p>
    <a href="${SITE_URL}/events/${event.id}" class="btn">View event</a>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: user.email,
    subject,
    html: baseTemplate(content),
  });
}

/**
 * Sent to all members when a new event is approved/published.
 */
export async function sendNewEventNotification({ event, recipients }) {
  if (!process.env.RESEND_API_KEY || !recipients.length) return;

  const content = `
    <h1>New event added</h1>
    <p>A new event has been added to the DCAUK community calendar:</p>
    <div class="event-card">
      <div class="event-title">${event.title}</div>
      ${event.organiser ? `<div class="event-meta">🏢 ${event.organiser}</div>` : ""}
      <div class="event-meta">📅 ${formatEventDate(event.startDate)}</div>
      ${event.location ? `<div class="event-meta">📍 ${event.location}</div>` : ""}
      ${event.description ? `<div class="event-meta" style="margin-top:8px;color:#475569;">${event.description}</div>` : ""}
    </div>
    <a href="${SITE_URL}/events/${event.id}" class="btn">View & RSVP →</a>
  `;

  // Send in batches of 50 using BCC to protect privacy
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: FROM_ADDRESS,  // send to self
      bcc: batch.map(r => r.email),
      subject: `New event: ${event.title}`,
      html: baseTemplate(content),
    });
  }
}

/**
 * Sent to the user when they remove their RSVP.
 */
export async function sendRsvpCancellation({ user, event }) {
  if (!process.env.RESEND_API_KEY) return;

  const content = `
    <h1>RSVP removed</h1>
    <p>Hi ${user.name || "there"},</p>
    <p>Your RSVP for the following event has been removed:</p>
    <div class="event-card">
      <div class="event-title">${event.title}</div>
      <div class="event-meta">📅 ${formatEventDate(event.startDate)}</div>
      ${event.location ? `<div class="event-meta">📍 ${event.location}</div>` : ""}
    </div>
    <p>Changed your mind? You can re-register at any time.</p>
    <a href="${SITE_URL}/events/${event.id}" class="btn">View event</a>
  `;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: user.email,
    subject: `RSVP removed: ${event.title}`,
    html: baseTemplate(content),
  });
}
