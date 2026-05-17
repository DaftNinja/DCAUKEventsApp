import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Get current user profile
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId));

    if (!user.length) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user[0]);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Update user profile
router.put("/me", authMiddleware, async (req, res) => {
  try {
    const { bio, headline, company } = req.body;

    const updated = await db
      .update(users)
      .set({
        bio: bio || undefined,
        headline: headline || undefined,
        company: company || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId))
      .returning();

    res.json(updated[0]);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
