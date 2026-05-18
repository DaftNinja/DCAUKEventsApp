import { Router } from "express";
import axios from "axios";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateToken } from "../middleware/auth.js";

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
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: "LinkedIn auth failed" });
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
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
      return res.status(400).json({ error: "Could not retrieve email from LinkedIn" });
    }

    let user = await db
      .select()
      .from(users)
      .where(eq(users.linkedin_id, linkedinId));

    if (user.length === 0) {
      console.log("🆕 Creating new user...");
      const result = await db
        .insert(users)
        .values({
          linkedin_id: linkedinId,
          email,
          name,
          avatar_url: avatarUrl,
        })
        .returning();
      user = result;
      console.log("✓ User created:", user[0].id);
    } else {
      console.log("🔄 Updating existing user...");
      await db
        .update(users)
        .set({
          email,
          name,
          avatar_url: avatarUrl,
          updated_at: new Date(),
        })
        .where(eq(users.linkedin_id, linkedinId));
      user = await db
        .select()
        .from(users)
        .where(eq(users.linkedin_id, linkedinId));
      console.log("✓ User updated:", user[0].id);
    }

    const token = generateToken(user[0].id);
    console.log("🎫 JWT generated");

    // Build redirect URL with https://
    const frontendUrl = process.env.FRONTEND_URL.startsWith('http') 
      ? process.env.FRONTEND_URL 
      : `https://${process.env.FRONTEND_URL}`;
    
    const redirectUrl = `${frontendUrl}/auth/success?token=${token}&userId=${user[0].id}`;
    console.log("🔀 Redirecting to:", redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error("❌ OAuth callback error:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", JSON.stringify(error.response.data));
    }
    res.status(500).json({ error: "Authentication failed", details: error.message });
  }
});

export default router;
