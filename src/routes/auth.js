import { Router } from "express";
import axios from "axios";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateToken, blockToken, authenticateToken } from "../middleware/auth.js";

const router = Router();

router.get("/linkedin", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: "openid profile email",
    state: Math.random().toString(36).substring(7),
  });

  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
});

router.get("/linkedin/callback", async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    console.log("❌ LinkedIn OAuth error:", error, error_description);
    return res.redirect(`/?error=${encodeURIComponent(error_description || "LinkedIn auth failed")}`);
  }

  if (!code) {
    return res.redirect("/?error=Missing%20authorization%20code");
  }

  try {
    console.log("🔐 Step 1: Exchanging code for token...");
    
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("✓ Token received");
    const accessToken = tokenResponse.data.access_token;

    console.log("🔐 Step 2: Fetching user info via OpenID Connect...");
    const userInfoResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log("✓ User info received");

    const linkedinId = userInfoResponse.data.sub;
    const name = userInfoResponse.data.name || "";
    const email = userInfoResponse.data.email || null;
    const avatarUrl = userInfoResponse.data.picture || null;

    console.log("📝 User data:", { linkedinId, name, email });

    if (!email) {
      return res.redirect("/?error=Could%20not%20retrieve%20email%20from%20LinkedIn");
    }

    console.log("🔐 Step 3: Checking if user exists...");
    let existingUser = await db
      .select()
      .from(users)
      .where(eq(users.linkedinId, linkedinId));

    console.log("✓ User query completed, result length:", existingUser.length);

    if (existingUser.length === 0) {
      console.log("🆕 Creating new user...");
      const result = await db
        .insert(users)
        .values({
          linkedinId,
          email,
          name,
          avatarUrl,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      existingUser = result;
      console.log("✓ User created:", result[0].id);
    } else {
      console.log("🔄 Updating existing user...");
      await db
        .update(users)
        .set({
          email,
          name,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.linkedinId, linkedinId));
      console.log("✓ User updated:", existingUser[0].id);
    }

    const token = generateToken(existingUser[0].id);
    console.log("🎫 JWT generated");

    const frontendUrl = process.env.FRONTEND_URL.startsWith("http") 
      ? process.env.FRONTEND_URL 
      : `https://${process.env.FRONTEND_URL}`;
    
    const redirectUrl = `${frontendUrl}/auth/success?token=${token}&userId=${existingUser[0].id}`;
    console.log("🔀 Redirecting to:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ OAuth callback error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data));
    }
    res.redirect(`/?error=${encodeURIComponent("Authentication failed: " + error.message)}`);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Invalidates the current token server-side by adding its jti to the blocklist
router.post("/logout", authenticateToken, (req, res) => {
  if (req.tokenJti && req.tokenExp) {
    // expiresAt in ms — token can't be used after this anyway
    blockToken(req.tokenJti, req.tokenExp * 1000);
  }
  res.json({ success: true });
});

export default router;
