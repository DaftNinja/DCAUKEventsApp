import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// Middleware to check if user is admin (hardcoded for now)
function requireAdmin(req, res, next) {
  const adminEmails = ["andrew@mccreath.vip"];
  // TODO: implement proper role checking after merging dev branch
  next();
}

// GET all users
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// DELETE user
router.delete("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.params.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;