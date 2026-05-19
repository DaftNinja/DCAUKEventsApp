import { Router } from "express";
import { db } from "../db/index.js";
import { users, userRoles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GET current user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: (u) => u.id === req.userId,
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = await db.query.userRoles.findFirst({
      where: (ur) => ur.userId === req.userId,
    });

    res.json({ ...user, role: userRole?.role || "user" });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PUT update current user
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const { name, headline, company, bio } = req.body;

    const updatedUser = await db
      .update(users)
      .set({
        name,
        headline,
        company,
        bio,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId))
      .returning();

    if (updatedUser.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userRole = await db.query.userRoles.findFirst({
      where: (ur) => ur.userId === req.userId,
    });

    console.log("✓ User profile updated");
    res.json({ ...updatedUser[0], role: userRole?.role || "user" });
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
