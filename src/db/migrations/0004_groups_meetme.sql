-- Groups feature + Meet-Me feature
-- Run in Railway Postgres console

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Group membership
CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator')),
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

-- Group posts
CREATE TABLE IF NOT EXISTS group_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  link_url        TEXT,
  link_title      TEXT,
  attachment_url  TEXT,
  attachment_name TEXT,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_posts_group_id_idx ON group_posts (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members (user_id);

-- Meet-Me: per-event opt-in on RSVPs
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS open_to_meeting BOOLEAN NOT NULL DEFAULT false;

-- Meet-Me: global default on user profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_open_to_meeting BOOLEAN NOT NULL DEFAULT false;

-- Seed some default groups
INSERT INTO groups (name, slug, description) VALUES
  ('AI & Data Infrastructure', 'ai-data-infrastructure', 'AI workloads, GPU clusters, and the infrastructure powering the next wave of compute.'),
  ('Sustainability & Net Zero', 'sustainability-net-zero', 'Renewable energy, PUE optimisation, carbon reporting, and the path to net zero.'),
  ('Colocation & Interconnection', 'colocation-interconnection', 'Colo strategy, IX points, carrier-neutral facilities, and interconnection trends.'),
  ('Edge Computing', 'edge-computing', 'Edge deployments, micro data centres, latency-sensitive workloads and 5G infrastructure.'),
  ('Power & Cooling', 'power-cooling', 'Power delivery, UPS, cooling strategies, liquid immersion, and energy efficiency.'),
  ('Investment & M&A', 'investment-ma', 'Capital flows, hyperscale deals, fund activity, and M&A across the sector.')
ON CONFLICT (slug) DO NOTHING;
