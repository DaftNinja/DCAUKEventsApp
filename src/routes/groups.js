import { Router } from "express";
import { db } from "../db/index.js";
import { groups, groupMembers, groupPosts, users } from "../db/schema.js";
import { eq, and, desc, sql } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { attachUser, requireAdmin } from "../middleware/authorize.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";

const router = Router();

const createGroupSchema = z.object({
  name:        z.string().min(2).max(100),
  slug:        z.string().min(2).max(60).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers and hyphens only"),
  description: z.string().max(500).optional(),
  imageUrl:    z.string().url().optional().or(z.literal("")),
});

const createPostSchema = z.object({
  content:        z.string().min(1).max(2000),
  linkUrl:        z.string().url().optional().or(z.literal("")),
  linkTitle:      z.string().max(200).optional(),
  attachmentUrl:  z.string().url().optional().or(z.literal("")),
  attachmentName: z.string().max(200).optional(),
});

// ─── GET /api/groups ──────────────────────────────────────────────────────────
// Returns all groups with member counts and current user's membership status
router.get("/", authenticateToken, async (req, res) => {
  try {
    const allGroups = await db.select().from(groups).orderBy(groups.name);

    // Get member counts and current user memberships in one query each
    const memberCounts = await db
      .select({
        groupId: groupMembers.groupId,
        count:   sql`count(*)`.as("count"),
      })
      .from(groupMembers)
      .groupBy(groupMembers.groupId);

    const userMemberships = await db
      .select({ groupId: groupMembers.groupId, role: groupMembers.role })
      .from(groupMembers)
      .where(eq(groupMembers.userId, req.userId));

    const countMap = Object.fromEntries(memberCounts.map(r => [r.groupId, Number(r.count)]));
    const membershipMap = Object.fromEntries(userMemberships.map(r => [r.groupId, r.role]));

    res.json(allGroups.map(g => ({
      ...g,
      memberCount: countMap[g.id] || 0,
      isMember:    !!membershipMap[g.id],
      memberRole:  membershipMap[g.id] || null,
    })));
  } catch (error) {
    console.error("Failed to fetch groups:", error);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// ─── POST /api/groups ─────────────────────────────────────────────────────────
// Admin only — create a new group
router.post("/", authenticateToken, attachUser, requireAdmin, validate(createGroupSchema), async (req, res) => {
  try {
    const { name, slug, description, imageUrl } = req.body;

    const [group] = await db
      .insert(groups)
      .values({
        name, slug,
        description: description || null,
        imageUrl:    imageUrl    || null,
        createdBy:   req.userId,
      })
      .returning();

    res.status(201).json(group);
  } catch (error) {
    if (error.message?.includes("unique")) {
      return res.status(400).json({ error: "A group with that slug already exists" });
    }
    console.error("Failed to create group:", error);
    res.status(500).json({ error: "Failed to create group" });
  }
});

// ─── GET /api/groups/:slug ────────────────────────────────────────────────────
// Group detail — posts + member list
router.get("/:slug", authenticateToken, async (req, res) => {
  try {
    const [group] = await db
      .select()
      .from(groups)
      .where(eq(groups.slug, req.params.slug))
      .limit(1);

    if (!group) return res.status(404).json({ error: "Group not found" });

    // Posts with author info
    const posts = await db
      .select({
        id:             groupPosts.id,
        content:        groupPosts.content,
        linkUrl:        groupPosts.linkUrl,
        linkTitle:      groupPosts.linkTitle,
        attachmentUrl:  groupPosts.attachmentUrl,
        attachmentName: groupPosts.attachmentName,
        createdAt:      groupPosts.createdAt,
        updatedAt:      groupPosts.updatedAt,
        author: {
          id:        users.id,
          name:      users.name,
          headline:  users.headline,
          company:   users.company,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(groupPosts)
      .innerJoin(users, eq(groupPosts.userId, users.id))
      .where(eq(groupPosts.groupId, group.id))
      .orderBy(desc(groupPosts.createdAt))
      .limit(50);

    // Members with profile info
    const members = await db
      .select({
        id:        users.id,
        name:      users.name,
        headline:  users.headline,
        company:   users.company,
        avatarUrl: users.avatarUrl,
        role:      groupMembers.role,
        joinedAt:  groupMembers.joinedAt,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, group.id))
      .orderBy(groupMembers.joinedAt);

    // Current user's membership
    const myMembership = members.find(m => m.id === req.userId);

    res.json({
      ...group,
      posts,
      members,
      isMember:   !!myMembership,
      memberRole: myMembership?.role || null,
      memberCount: members.length,
    });
  } catch (error) {
    console.error("Failed to fetch group:", error);
    res.status(500).json({ error: "Failed to fetch group" });
  }
});

// ─── DELETE /api/groups/:slug ─────────────────────────────────────────────────
router.delete("/:slug", authenticateToken, attachUser, requireAdmin, async (req, res) => {
  try {
    const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, req.params.slug)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });

    await db.delete(groups).where(eq(groups.id, group.id));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete group:", error);
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// ─── POST /api/groups/:slug/join ──────────────────────────────────────────────
router.post("/:slug/join", authenticateToken, async (req, res) => {
  try {
    const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, req.params.slug)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });

    await db
      .insert(groupMembers)
      .values({ groupId: group.id, userId: req.userId })
      .onConflictDoNothing();

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to join group:", error);
    res.status(500).json({ error: "Failed to join group" });
  }
});

// ─── DELETE /api/groups/:slug/join ────────────────────────────────────────────
router.delete("/:slug/join", authenticateToken, async (req, res) => {
  try {
    const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, req.params.slug)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });

    await db
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, req.userId)));

    res.json({ success: true });
  } catch (error) {
    console.error("Failed to leave group:", error);
    res.status(500).json({ error: "Failed to leave group" });
  }
});

// ─── POST /api/groups/:slug/posts ─────────────────────────────────────────────
router.post("/:slug/posts", authenticateToken, validate(createPostSchema), async (req, res) => {
  try {
    const [group] = await db.select({ id: groups.id }).from(groups).where(eq(groups.slug, req.params.slug)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Must be a member to post
    const [membership] = await db
      .select()
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, req.userId)))
      .limit(1);

    if (!membership) return res.status(403).json({ error: "You must join this group to post" });

    const { content, linkUrl, linkTitle, attachmentUrl, attachmentName } = req.body;

    const [post] = await db
      .insert(groupPosts)
      .values({
        groupId:        group.id,
        userId:         req.userId,
        content,
        linkUrl:        linkUrl        || null,
        linkTitle:      linkTitle      || null,
        attachmentUrl:  attachmentUrl  || null,
        attachmentName: attachmentName || null,
      })
      .returning();

    // Return post with author info
    const [author] = await db
      .select({ id: users.id, name: users.name, headline: users.headline, company: users.company, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, req.userId))
      .limit(1);

    res.status(201).json({ ...post, author });
  } catch (error) {
    console.error("Failed to create post:", error);
    res.status(500).json({ error: "Failed to create post" });
  }
});

// ─── DELETE /api/groups/:slug/posts/:postId ───────────────────────────────────
router.delete("/:slug/posts/:postId", authenticateToken, attachUser, async (req, res) => {
  try {
    const [post] = await db.select().from(groupPosts).where(eq(groupPosts.id, req.params.postId)).limit(1);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const isOwner = post.userId === req.userId;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ error: "Not allowed" });

    await db.delete(groupPosts).where(eq(groupPosts.id, req.params.postId));
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete post:", error);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

export default router;
