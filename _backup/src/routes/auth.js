import { Router } from "express";
import axios from "axios";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { generateToken } from "../middleware/auth.js";

const router = Router();

// Step 1: Redirect user to LinkedIn authorization
router.get("/linkedin", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
    scope: "openid profile email",
    state: Math.random().toString(36).substring(7), // Basic state for CSRF protection
  });

  res.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`
  );
});

// Step 2: Handle LinkedIn callback
router.get("/linkedin/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({ error: "LinkedIn auth failed" });
  }

  if (!code) {
    return res.status(400).json({ error: "Missing authorization code" });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        grant_type: "authorization_code",
        code,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch user profile from LinkedIn
    const profileResponse = await axios.get("https://api.linkedin.com/v2/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const emailResponse = await axios.get(
      "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const linkedinId = profileResponse.data.id;
    const name =
      `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName}`.trim();
    const email =
      emailResponse.data.elements[0]?.["handle~"]?.emailAddress || null;
    const avatarUrl = profileResponse.data.profilePicture?.displayImage || null;

    if (!email) {
      return res.status(400).json({ error: "Could not retrieve email from LinkedIn" });
    }

    // Upsert user
    let user = await db
      .select()
      .from(users)
      .where(eq(users.linkedinId, linkedinId));

    if (user.length === 0) {
      // Create new user
      const result = await db
        .insert(users)
        .values({
          linkedinId,
          email,
          name,
          avatarUrl,
        })
        .returning();
      user = result;
    } else {
      // Update existing user
      await db
        .update(users)
        .set({
          email,
          name,
          avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.linkedinId, linkedinId));
      user = await db
        .select()
        .from(users)
        .where(eq(users.linkedinId, linkedinId));
    }

    // Generate JWT
    const token = generateToken(user[0].id);

    // Redirect to frontend with token
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/success?token=${token}&userId=${user[0].id}`
    );
  } catch (error) {
    console.error("OAuth callback error:", error.message);
    res.status(500).json({ error: "Authentication failed" });
  }
});

export default router;
