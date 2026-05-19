import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";

const router = Router();

// GET current user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId));

    if (user.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user[0]);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PUT update user profile
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const { name, headline, company, bio, avatarUrl } = req.body;

    const updated = await db
      .update(users)
      .set({
        name: name || undefined,
        headline: headline || undefined,
        company: company || undefined,
        bio: bio || undefined,
        avatarUrl: avatarUrl || undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log("✓ User updated:", req.userId);
    res.json(updated[0]);
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
