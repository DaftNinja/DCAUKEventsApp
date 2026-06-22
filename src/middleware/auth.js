import jwt from "jsonwebtoken";
import { logger } from "../utils/logger.js";

// ─── Token blocklist ──────────────────────────────────────────────────────────
// In-memory store of invalidated token JTIs (JWT IDs).
// Each entry: { jti, expiresAt } — cleaned up automatically.
// This is sufficient for a single-instance deployment (Railway).
// For multi-instance, migrate to Redis or a DB-backed blocklist.

const blocklist = new Map(); // jti → expiry timestamp (ms)

// Clean up expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of blocklist) {
    if (expiresAt < now) blocklist.delete(jti);
  }
}, 15 * 60 * 1000);

export function blockToken(jti, expiresAt) {
  blocklist.set(jti, expiresAt);
}

function isBlocked(jti) {
  if (!jti) return false;
  const expiresAt = blocklist.get(jti);
  if (!expiresAt) return false;
  if (expiresAt < Date.now()) {
    blocklist.delete(jti);
    return false;
  }
  return true;
}

// ─── Token generation ─────────────────────────────────────────────────────────

export function generateToken(userId) {
  // Include jti (JWT ID) so individual tokens can be invalidated on logout
  const jti = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return jwt.sign({ userId, jti }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

// ─── Token verification middleware ────────────────────────────────────────────

export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check blocklist — rejects tokens invalidated on logout
    if (isBlocked(decoded.jti)) {
      return res.status(401).json({ error: "Token has been invalidated" });
    }

    req.userId  = decoded.userId;
    req.tokenJti = decoded.jti;
    req.tokenExp = decoded.exp; // seconds since epoch
    next();
  } catch (error) {
    logger.error({ error: error.message }, "Token verification failed");
    res.status(403).json({ error: "Invalid or expired token" });
  }
}
