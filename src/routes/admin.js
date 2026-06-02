import { Router } from "express";
import { db } from "../db/index.js";
import { users, rsvps, events } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { attachUser, requireAdmin } from "../middleware/authorize.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(authenticateToken, attachUser, requireAdmin);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const updateRoleSchema = z.object({
  role: z.enum(["member", "organiser", "admin"]),
});

const updateUserSchema = z.object({
  name:     z.string().min(1).max(200).optional(),
  email:    z.string().email().optional(),
  company:  z.string().max(200).optional().or(z.literal("")),
  headline: z.string().max(300).optional().or(z.literal("")),
  bio:      z.string().max(2000).optional().or(z.literal("")),
  role:     z.enum(["member", "organiser", "admin"]).optional(),
  status:   z.enum(["active", "suspended"]).optional(),
});

const createUserSchema = z.object({
  name:     z.string().min(1).max(200),
  email:    z.string().email(),
  company:  z.string().max(200).optional(),
  headline: z.string().max(300).optional(),
  role:     z.enum(["member", "organiser", "admin"]).default("member"),
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
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
        bio:       users.bio,
        role:      users.role,
        status:    users.status,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.createdAt);

    res.json(allUsers);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ─── GET /api/admin/users/:id ─────────────────────────────────────────────────
router.get("/users/:id", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.params.id))
      .limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });

    // Also fetch their RSVP count
    const userRsvps = await db
      .select({ status: rsvps.status })
      .from(rsvps)
      .where(eq(rsvps.userId, req.params.id));

    const rsvpCounts = {
      going:      userRsvps.filter(r => r.status === "going").length,
      interested: userRsvps.filter(r => r.status === "interested").length,
    };

    // Remove linkedinId from response
    const { linkedinId, ...safeUser } = user;
    res.json({ ...safeUser, rsvpCounts });
  } catch (error) {
    console.error("Failed to fetch user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ─── PUT /api/admin/users/:id ─────────────────────────────────────────────────
// Full user update — name, email, company, headline, bio, role, status
router.put("/users/:id", validate(updateUserSchema), async (req, res) => {
  try {
    const { name, email, company, headline, bio, role, status } = req.body;

    // Prevent admin from demoting or suspending themselves
    if (req.params.id === req.user.id) {
      if (role && role !== "admin") {
        return res.status(400).json({ error: "You cannot change your own admin role" });
      }
      if (status === "suspended") {
        return res.status(400).json({ error: "You cannot suspend your own account" });
      }
    }

    const updateData = {
      updatedAt: new Date(),
      ...(name     !== undefined && { name }),
      ...(email    !== undefined && { email }),
      ...(company  !== undefined && { company }),
      ...(headline !== undefined && { headline }),
      ...(bio      !== undefined && { bio }),
      ...(role     !== undefined && { role }),
      ...(status   !== undefined && { status }),
    };

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.params.id))
      .returning({
        id:       users.id,
        name:     users.name,
        email:    users.email,
        company:  users.company,
        headline: users.headline,
        bio:      users.bio,
        role:     users.role,
        status:   users.status,
      });

    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json(updated);
  } catch (error) {
    // Handle unique email constraint violation
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "That email address is already in use" });
    }
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ─── PUT /api/admin/users/:id/role ────────────────────────────────────────────
// Kept for backwards compatibility with existing frontend role dropdown
router.put("/users/:id/role", validate(updateRoleSchema), async (req, res) => {
  try {
    const { role } = req.body;

    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "You cannot change your own admin role" });
    }

    const [updated] = await db
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, name: users.name, email: users.email, role: users.role });

    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json(updated);
  } catch (error) {
    console.error("Failed to update role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
// Manually create a user account (no LinkedIn required)
router.post("/users", validate(createUserSchema), async (req, res) => {
  try {
    const { name, email, company, headline, role } = req.body;

    const [newUser] = await db
      .insert(users)
      .values({
        linkedinId: `manual_${uuidv4()}`, // synthetic LinkedIn ID for manually added users
        email,
        name,
        company:  company  || null,
        headline: headline || null,
        role:     role     || "member",
        status:   "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({
        id:       users.id,
        name:     users.name,
        email:    users.email,
        company:  users.company,
        headline: users.headline,
        role:     users.role,
        status:   users.status,
        createdAt: users.createdAt,
      });

    res.status(201).json(newUser);
  } catch (error) {
    if (error.message?.includes("unique") || error.message?.includes("duplicate")) {
      return res.status(400).json({ error: "A user with that email already exists" });
    }
    console.error("Failed to create user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete("/users/:id", async (req, res) => {
  try {
    // Prevent admin from deleting themselves
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    // RSVPs cascade-delete automatically (foreign key ON DELETE CASCADE)
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, req.params.id))
      .returning({ id: users.id, name: users.name });

    if (!deleted) return res.status(404).json({ error: "User not found" });
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;
