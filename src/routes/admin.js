import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { attachUser, requireAdmin } from "../middleware/authorize.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticateToken, attachUser, requireAdmin);

const updateRoleSchema = z.object({
  role: z.enum(["member", "organiser", "admin"], {
    errorMap: () => ({ message: "Role must be member, organiser, or admin" }),
  }),
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Returns all users with public + role fields. Never exposes linkedinId.
router.get("/users", async (req, res) => {
  try {
    const allUsers = await db
      .select({
        id:        users.id,
        name:      users.name,
        email:     users.email,
        headline:  users.headline,
        company:   users.company,
        avatarUrl: users.avatarUrl,
        role:      users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    res.json(allUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── PUT /api/admin/users/:id/role ────────────────────────────────────────────
router.put("/users/:id/role", validate(updateRoleSchema), async (req, res) => {
  try {
    const { role } = req.body;

    // Prevent admin from demoting themselves
    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "You cannot change your own admin role" });
    }

    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({
        id:    users.id,
        name:  users.name,
        email: users.email,
        role:  users.role,
      });

    if (!updated) return res.status(404).json({ error: "User not found" });

    res.json(updated);
  } catch (error) {
    console.error("Failed to update role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

export default router;
