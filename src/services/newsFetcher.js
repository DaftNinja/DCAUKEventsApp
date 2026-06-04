import { db } from "../db/index.js";
import { newsItems } from "../db/schema.js";
import { sql } from "drizzle-orm";

// ─── Curated industry RSS feeds ───────────────────────────────────────────────

const RSS_FEEDS = [
  {
    source: "Data Centre Dynamics",
    url: "https://www.datacenterdynamics.com/en/rss/",
  },
  {
    source: "Data Centre Magazine",
    url: "https://www.datacentremagazine.com/rss.xml",
  },
  {
    source: "BizClik Media — Data Centre",
    url: "https://www.bizclikmedia.net/data-centre/rss",
  },
  {
    source: "ITPro — Data Centre",
    url: "https://www.itpro.com/data-centre/feed",
  },
  {
    source: "ComputerWeekly — Data Centre",
    url: "https://www.computerweekly.com/rss/IT-infrastructure.xml",
  },
  {
    source: "The Register — Data Centre",
    url: "https://www.theregister.com/data_centre/rss",
  },
  {
    source: "DatacenterKnowledge",
    url: "https://www.datacenterknowledge.com/rss.xml",
  },
];

// ─── Simple XML parser (no dependencies) ──────────────────────────────────────

function extractText(xml, tag) {
  const patterns = [
    new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"),
    new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function extractImage(itemXml) {
  // Try media:content, media:thumbnail, enclosure, og:image in description
  const patterns = [
    /<media:content[^>]+url="([^"]+)"/i,
    /<media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"/i,
    /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/i,
  ];
  for (const pattern of patterns) {
    const match = itemXml.match(pattern);
    if (match) return match[1] || match[0];
  }
  return null;
}

function parseItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = extractText(itemXml, "title");
    const link  = extractText(itemXml, "link") || extractText(itemXml, "guid");
    const desc  = extractText(itemXml, "description");
    const pubDate = extractText(itemXml, "pubDate") || extractText(itemXml, "dc:date");
    const image = extractImage(itemXml);

    if (!title || !link) continue;

    // Clean summary — strip HTML tags and residual attribute fragments
    const summary = desc
      ? desc
          .replace(/<!\[CDATA\[/gi, "")       // strip CDATA openers
          .replace(/\]\]>/g, "")               // strip CDATA closers
          .replace(/<[^>]+>/g, " ")            // strip HTML tags
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, " ")
          // Remove leftover HTML attribute fragments e.g. data-block-key="abc"
          .replace(/[a-z-]+=(["'])[^"']*\1/gi, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300)
      : null;

    const publishedAt = pubDate ? new Date(pubDate) : new Date();

    // Skip if date is invalid or in the future
    if (isNaN(publishedAt.getTime())) continue;

    items.push({ title, url: link, summary, publishedAt, image });
  }

  return items;
}

// ─── Fetch a single feed ──────────────────────────────────────────────────────

async function fetchFeed(feed) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "DCAUK-News-Aggregator/1.0" },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`RSS fetch failed for ${feed.source}: ${res.status}`);
      return [];
    }

    const xml = await res.text();
    const items = parseItems(xml);
    console.log(`  ✓ ${feed.source}: ${items.length} items`);
    return items.map(item => ({ ...item, source: feed.source }));
  } catch (err) {
    if (err.name === "AbortError") {
      console.error(`RSS timeout for ${feed.source}`);
    } else {
      console.error(`RSS error for ${feed.source}:`, err.message);
    }
    return [];
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * fetchAndStoreNews — fetches all RSS feeds and upserts new items.
 * Called hourly by the scheduler in index.js.
 * Keeps only the most recent 500 RSS items to avoid unbounded growth.
 */
export async function fetchAndStoreNews() {
  console.log("📰 Fetching RSS feeds...");

  // Fetch all feeds concurrently
  const results = await Promise.all(RSS_FEEDS.map(fetchFeed));
  const allItems = results.flat();

  if (allItems.length === 0) {
    console.log("📰 No new items fetched");
    return;
  }

  // Insert new items, skip duplicates by URL
  let inserted = 0;
  for (const item of allItems) {
    try {
      await db
        .insert(newsItems)
        .values({
          title:       item.title.slice(0, 500),
          summary:     item.summary,
          url:         item.url,
          source:      item.source,
          imageUrl:    item.image || null,
          publishedAt: item.publishedAt,
          type:        "rss",
        })
        .onConflictDoNothing({ target: newsItems.url });
      inserted++;
    } catch (err) {
      // Skip items that fail (malformed URLs etc.)
    }
  }

  console.log(`📰 Stored ${inserted} new items from ${RSS_FEEDS.length} feeds`);

  // Prune old RSS items — keep most recent 500
  await db.execute(sql`
    DELETE FROM news_items
    WHERE type = 'rss'
    AND id NOT IN (
      SELECT id FROM news_items
      WHERE type = 'rss'
      ORDER BY published_at DESC
      LIMIT 500
    )
  `);
}
