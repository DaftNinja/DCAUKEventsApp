import { Router } from "express";
import { db } from "../db/index.js";
import { users, userRoles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// Middleware to check if user is admin
async function requireAdmin(req, res, next) {
  try {
    const userRole = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, req.userId));

    if (userRole.length === 0 || userRole[0].role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    next();
  } catch (error) {
    console.error("Admin check failed:", error);
    res.status(500).json({ error: "Admin check failed" });
  }
}

// GET all users with roles
router.get("/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        const roles = await db
          .select()
          .from(userRoles)
          .where(eq(userRoles.userId, user.id));
        return {
          ...user,
          role: roles.length > 0 ? roles[0].role : "user",
        };
      })
    );
    res.json(usersWithRoles);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// PUT update user role
router.put("/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["admin", "organizer", "user"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    // Delete existing role
    await db.delete(userRoles).where(eq(userRoles.userId, req.params.id));

    // Create new role
    const newRole = await db
      .insert(userRoles)
      .values({
        userId: req.params.id,
        role,
        createdAt: new Date(),
      })
      .returning();

    res.json(newRole[0]);
  } catch (error) {
    console.error("Failed to update user role:", error);
    res.status(500).json({ error: "Failed to update user role" });
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