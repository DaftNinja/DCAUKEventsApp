import { db } from "../db/index.js";
import { events, users } from "../db/schema.js";
import { eq } from "drizzle-orm";

// ─── Role helpers ─────────────────────────────────────────────────────────────

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isOrganiserOrAdmin(user) {
  return user?.role === "organiser" || user?.role === "admin";
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * attachUser — loads the full user record from DB and attaches to req.user.
 * Must run after authenticateToken (which sets req.userId).
 * Use this before any middleware that needs req.user.role.
 */
export async function attachUser(req, res, next) {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user) return res.status(401).json({ error: "User not found" });
    req.user = user;
    next();
  } catch (error) {
    console.error("Failed to attach user:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * requireAdmin — 403 unless the authenticated user has role 'admin'.
 * Must run after attachUser.
 */
export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) {
    return res.status(403).json({ error: "Forbidden: admin access only" });
  }
  next();
}

/**
 * requireOrganiserOrAdmin — 403 unless organiser or admin.
 * Must run after attachUser.
 */
export function requireOrganiserOrAdmin(req, res, next) {
  if (!isOrganiserOrAdmin(req.user)) {
    return res.status(403).json({ error: "Forbidden: organiser access only" });
  }
  next();
}

/**
 * fetchEvent — loads the event by :id and attaches it to req.event.
 */
export async function fetchEvent(req, res, next) {
  try {
    const [event] = await db
      .select()
      .from(events)
      .where(eq(events.id, req.params.id))
      .limit(1);

    if (!event) return res.status(404).json({ error: "Event not found" });
    req.event = event;
    next();
  } catch (error) {
    console.error("Failed to fetch event:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/**
 * requireOwnerOrAdmin — 403 unless the authenticated user created the event
 * or is an admin. Must run after fetchEvent and attachUser.
 */
export function requireOwnerOrAdmin(req, res, next) {
  const isOwner = req.event.organizerId === req.user.id;
  if (!isOwner && !isAdmin(req.user)) {
    return res.status(403).json({ error: "Forbidden: you don't own this event" });
  }
  next();
}
