import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

async function runMigrations() {
  console.log("🔄 Running migrations...");

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "linkedinId" TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        headline TEXT,
        company TEXT,
        "avatarUrl" TEXT,
        bio TEXT,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ users table ready");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        description TEXT,
        "startDate" TIMESTAMP NOT NULL,
        "endDate" TIMESTAMP NOT NULL,
        location TEXT,
        "isVirtual" BOOLEAN DEFAULT FALSE,
        organiser TEXT,
        "organizerEmail" TEXT,
        "organizerId" UUID REFERENCES users(id) ON DELETE SET NULL,
        "eventUrl" TEXT,
        status TEXT DEFAULT 'pending',
        "approvedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ events table ready");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS rsvps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "eventId" UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT rsvps_user_event_unique UNIQUE ("userId", "eventId"),
        CONSTRAINT status_check CHECK (status IN ('interested', 'going'))
      );
    `);
    console.log("✓ rsvps table ready");

    console.log("✅ All migrations completed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
