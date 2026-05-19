import { Router } from "express";
import axios from "axios";
import { db } from "../db/index.js";
import { users, userRoles } from "../db/schema.js";
import { generateToken } from "../middleware/auth.js";

const router = Router();

// LinkedIn OAuth redirect
router.get("/linkedin", (req, res) => {
  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", process.env.LINKEDIN_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", process.env.LINKEDIN_REDIRECT_URI);
  authUrl.searchParams.append("scope", "openid profile email");
  res.redirect(authUrl.toString());
});

// LinkedIn OAuth callback
router.get("/linkedin/callback", async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ error: "No authorization code received" });
    }

    // Exchange code for token
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const { access_token } = tokenRes.data;

    // Fetch user profile
    const profileRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { sub, name, email, picture } = profileRes.data;

    // Find or create user
    let user = await db.query.users.findFirst({
      where: (u) => u.linkedinId === sub,
    });

    if (!user) {
      const newUser = await db
        .insert(users)
        .values({
          linkedinId: sub,
          email,
          name,
          avatarUrl: picture,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      user = newUser[0];

      // Try to assign default 'user' role (skip if table doesn't exist yet)
      try {
        await db.insert(userRoles).values({
          userId: user.id,
          role: "user",
          createdAt: new Date(),
        });
      } catch (roleErr) {
        console.warn("⚠️ Could not assign user role (table may not exist):", roleErr.message);
      }

      console.log(`✓ New user registered: ${email}`);
    }

    // Generate JWT
    const token = generateToken(user.id);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth-callback?token=${token}`);
  } catch (error) {
    console.error("LinkedIn auth failed:", error.message);
    res.status(500).json({ error: "LinkedIn auth failed: " + error.message });
  }
});

export default router;
