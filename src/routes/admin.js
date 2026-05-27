import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

const ADMIN_EMAILS = ["andrew@mccreath.vip"];

// [SECURITY FIX] requireAdmin now actually checks the authenticated user's email.
// Previously this function always called next() unconditionally — meaning any
// logged-in user could list or delete all users.
function requireAdmin(req, res, next) {
  if (!req.user || !ADMIN_EMAILS.includes(req.user.email)) {
    return res.status(403).json({ error: "Forbidden: admin access only" });
  }
  next();
}

// GET /api/admin/users — list all users (admin only)
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// DELETE /api/admin/users/:id — delete a user (admin only)
router.delete("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.params.id));
    console.log(`✓ User deleted: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
