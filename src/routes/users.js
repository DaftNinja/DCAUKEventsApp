import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { validate, updateProfileSchema } from "../middleware/validate.js";

const router = Router();

// ─── GET /api/users/me ────────────────────────────────────────────────────────
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(user);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── PUT /api/users/me ────────────────────────────────────────────────────────
router.put("/me", authenticateToken, validate(updateProfileSchema), async (req, res) => {
  try {
    const { name, headline, company, bio, avatarUrl } = req.body;

    const [updated] = await db
      .update(users)
      .set({
        ...(name      !== undefined && { name }),
        ...(headline  !== undefined && { headline }),
        ...(company   !== undefined && { company }),
        ...(bio       !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, req.userId))
      .returning();

    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
