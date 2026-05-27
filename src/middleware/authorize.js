import { db } from "../db/index.js";
import { events } from "../db/schema.js";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = ["andrew@mccreath.vip"];

/**
 * requireAdmin — 403 unless the authenticated user's email is in ADMIN_EMAILS.
 * Use on approve / reject / delete routes.
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ error: "Forbidden: admin access only" });
  }
  next();
}

/**
 * fetchEvent — loads the event by :id and attaches it to req.event.
 * Returns 404 if the event doesn't exist.
 * Always use this before requireOwnerOrAdmin.
 */
export async function fetchEvent(req, res, next) {
  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    req.event = event;
    next();
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * requireOwnerOrAdmin — 403 unless the authenticated user created the event,
 * or is an admin. Use on update/delete routes after fetchEvent.
 */
export function requireOwnerOrAdmin(req, res, next) {
  const isOwner = req.event.organizerId === req.user.id;
  const isAdmin = ADMIN_EMAILS.includes(req.user.email);

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: "Forbidden: you don't own this event" });
  }
  next();
}
