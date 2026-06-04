-- News items table
-- Stores both RSS-fetched and admin-manually-posted news
CREATE TABLE IF NOT EXISTS news_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMP NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss' CHECK (type IN ('rss', 'manual')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS news_items_published_at_idx ON news_items (published_at DESC);
CREATE INDEX IF NOT EXISTS news_items_type_idx ON news_items (type);
