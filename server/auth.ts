import crypto from "crypto";
import { db } from "./db.js";
import { users, signinTokens, auditLogs } from "../shared/schema.js";
import { eq, and, gt, isNull } from "drizzle-orm";
import type { User } from "../shared/schema.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ADMIN_EMAIL = "andrew.mccreath@1giglabs.com";
const FREE_CREDITS = 5;
const MAGIC_LINK_EXPIRY_MINUTES = 15;

// Personal/free email domains that aren't allowed to sign up.
const BLOCKED_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.fr",
  "hotmail.com", "hotmail.co.uk", "hotmail.fr", "outlook.com", "live.com",
  "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "protonmail.com", "proton.me", "tutanota.com", "zohomail.com",
  "yandex.com", "yandex.ru", "mail.com", "gmx.com", "gmx.net",
]);

export function isBusinessEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  return !BLOCKED_DOMAINS.has(domain);
}

export function isAdmin(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSigninToken(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);
  await db.insert(signinTokens).values({ userId, token, expiresAt });
  return token;
}

/**
 * Look up and consume a magic-link token. Returns the user if the token is
 * valid, unused, and not expired; otherwise returns null. Marks the token
 * as used atomically so it can only be redeemed once.
 */
export async function consumeSigninToken(token: string): Promise<User | null> {
  const now = new Date();

  // Mark used only if currently unused and unexpired — single atomic write.
  const updated = await db
    .update(signinTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(signinTokens.token, token),
        gt(signinTokens.expiresAt, now),
        isNull(signinTokens.usedAt),
      )
    )
    .returning();

  if (!updated[0]) return null;

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, updated[0].userId))
    .limit(1);
  return userRows[0] ?? null;
}

// ─── User management ──────────────────────────────────────────────────────────

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: number): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  email: string,
  firstName: string,
  lastName: string,
  company?: string
): Promise<User> {
  const admin = isAdmin(email);
  const [user] = await db.insert(users).values({
    email: email.toLowerCase(),
    firstName,
    lastName,
    company,
    isActive: true,
    // Admin gets effectively unlimited credits.
    reportCredits: admin ? 999999 : FREE_CREDITS,
  }).returning();
  return user;
}

export async function updateLastLogin(userId: number): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function decrementCredits(userId: number): Promise<number> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");
  const newCredits = Math.max(0, user.reportCredits - 1);
  await db.update(users).set({ reportCredits: newCredits }).where(eq(users.id, userId));
  return newCredits;
}

// ─── Audit logging ────────────────────────────────────────────────────────────

export async function writeAuditLog(
  action: string,
  detail?: string,
  userId?: number,
  email?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: userId ?? null,
      email: email ?? null,
      action,
      detail: detail ?? null,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    });
  } catch (err) {
    // Audit logging must never break the main request flow.
    console.error("Audit log write failed:", err);
  }
}
