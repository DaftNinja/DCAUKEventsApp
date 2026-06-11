import { Router } from "express";
import {
  createUser, getUserByEmail, getUserById, updateLastLogin,
  createSigninToken, consumeSigninToken,
  isBusinessEmail, isAdmin, writeAuditLog,
} from "./auth.js";
import { sendMagicLinkEmail } from "./email.js";
import { db } from "./db.js";
import { auditLogs, RequestLinkSchema } from "../shared/schema.js";
import { desc } from "drizzle-orm";

export const authRouter = Router();

const APP_URL = process.env.APP_URL ?? "/";

// ─── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId || !req.session?.isAdmin) {
    return res.status(403).json({ error: "Not authorised" });
  }
  next();
}

// Helper to get client IP honoring proxy headers.
function getIp(req: any): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? "unknown";
}

// Neutral response body, used to avoid leaking whether an email exists.
const NEUTRAL_LINK_RESPONSE = {
  message: "If that email is eligible, a sign-in link has been sent. Check your inbox.",
};

// ─── Request magic link (sign-in + sign-up combined) ──────────────────────────

authRouter.post("/request-link", async (req, res) => {
  const parse = RequestLinkSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0].message });
  }

  const { email, firstName, lastName, company } = parse.data;
  const ip = getIp(req);
  const ua = req.headers["user-agent"];

  if (!isBusinessEmail(email)) {
    await writeAuditLog("LINK_BLOCKED_PERSONAL", `Personal email domain: ${email}`, undefined, email, ip, ua);
    return res.status(400).json({
      error: "Please use a business email address. Personal email domains (Gmail, Hotmail, Yahoo etc.) aren't accepted.",
    });
  }

  try {
    let user = await getUserByEmail(email);

    if (!user) {
      // Treat as sign-up. Require names for new accounts.
      if (!firstName || !lastName) {
        return res.status(400).json({
          error: "First name and last name are required to create an account.",
          newUser: true,
        });
      }
      user = await createUser(email, firstName, lastName, company);
      await writeAuditLog("REGISTER", `New signup: ${email}`, user.id, email, ip, ua);
    }

    if (!user.isActive) {
      // Silent — don't tell the caller the account is deactivated.
      return res.json(NEUTRAL_LINK_RESPONSE);
    }

    const token = await createSigninToken(user.id);
    await sendMagicLinkEmail(email, user.firstName, token);
    await writeAuditLog("LINK_REQUESTED", undefined, user.id, email, ip, ua);

    res.json(NEUTRAL_LINK_RESPONSE);
  } catch (err: any) {
    console.error("request-link error:", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ─── Callback — consumes magic link, creates session, redirects to app ────────

authRouter.get("/callback", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const ip = getIp(req);
  const ua = req.headers["user-agent"];

  // Build redirect targets as RELATIVE paths so they work even if APP_URL is
  // unset. Relative 302s keep the browser on the current origin.
  const loginWith = (code: string) => `/login?error=${code}`;

  try {
    if (!token) return res.redirect(loginWith("missing_token"));

    const user = await consumeSigninToken(token);
    if (!user) {
      await writeAuditLog("LINK_INVALID", `Invalid/expired token`, undefined, undefined, ip, ua);
      return res.redirect(loginWith("invalid_link"));
    }

    if (!user.isActive) {
      await writeAuditLog("LINK_DENIED_INACTIVE", undefined, user.id, user.email, ip, ua);
      return res.redirect(loginWith("account_disabled"));
    }

    await updateLastLogin(user.id);

    (req.session as any).userId = user.id;
    (req.session as any).email = user.email;
    (req.session as any).isAdmin = isAdmin(user.email);

    await writeAuditLog("LOGIN", undefined, user.id, user.email, ip, ua);

    // Save session before redirecting so the cookie is persisted.
    req.session.save((err) => {
      if (err) {
        console.error("session.save error:", err);
        return res.redirect(loginWith("session_failed"));
      }
      res.redirect("/");
    });
  } catch (err) {
    // Never let the callback silently close the connection — always redirect.
    console.error("callback handler error:", err);
    try {
      res.redirect(loginWith("server_error"));
    } catch {
      res.status(500).send("Sign-in failed. Please request a new link.");
    }
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────

authRouter.post("/logout", async (req, res) => {
  const userId = req.session?.userId;
  const email = req.session?.email;

  req.session.destroy(() => {});

  if (userId) {
    await writeAuditLog("LOGOUT", undefined, userId, email, getIp(req));
  }

  res.json({ message: "Logged out." });
});

// ─── Current session ──────────────────────────────────────────────────────────

authRouter.get("/me", async (req, res) => {
  if (!req.session?.userId) return res.json({ user: null });

  const user = await getUserById(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      reportCredits: user.reportCredits,
      isAdmin: isAdmin(user.email),
    },
  });
});

// ─── Audit log (admin only) ───────────────────────────────────────────────────

authRouter.get("/audit-log", requireAdmin, async (req, res) => {
  const page = parseInt(req.query.page as string ?? "1") || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  const logs = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ logs, page, limit });
});
