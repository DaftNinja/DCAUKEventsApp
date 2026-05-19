import { Router } from "express";
import { db } from "../db/index.js";
import { users, userRoles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// Middleware: check if user is admin
async function isAdmin(req, res, next) {
  try {
    const userRole = await db.query.userRoles.findFirst({
      where: (ur) => ur.userId === req.userId && ur.role === "admin",
    });
    if (!userRole) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Auth check failed" });
  }
}

// GET all users (admin only)
router.get("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const allUsers = await db.query.users.findMany();
    const usersWithRoles = await Promise.all(
      allUsers.map(async (u) => {
        const role = await db.query.userRoles.findFirst({
          where: (ur) => ur.userId === u.id,
        });
        return { ...u, role: role?.role || "user" };
      })
    );
    res.json(usersWithRoles);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST create user (admin only)
router.post("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, name, role } = req.body;

    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: (u) => u.email === email,
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Create user
    const newUser = await db
      .insert(users)
      .values({
        email,
        name,
        linkedinId: `admin-created-${Date.now()}-${Math.random()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // Assign role
    await db.insert(userRoles).values({
      userId: newUser[0].id,
      role: role || "user",
      createdAt: new Date(),
    });

    console.log(`✓ User created: ${email} with role ${role}`);
    res
      .status(201)
      .json({ ...newUser[0], role: role || "user" });
  } catch (error) {
    console.error("Failed to create user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT update user (admin only)
router.put("/users/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, name, role } = req.body;

    // Update user
    const updatedUser = await db
      .update(users)
      .set({
        email,
        name,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.params.id))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update role
    if (role) {
      await db
        .update(userRoles)
        .set({ role })
        .where(eq(userRoles.userId, req.params.id));
    }

    console.log(`✓ User updated: ${email}`);
    res.json({ ...updatedUser[0], role });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE user (admin only)
router.delete("/users/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.params.id));
    console.log("✓ User deleted");
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
