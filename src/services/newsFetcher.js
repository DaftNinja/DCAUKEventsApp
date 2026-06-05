import { db } from "../db/index.js";
import { newsItems } from "../db/schema.js";
import { sql } from "drizzle-orm";

// ─── Curated industry RSS feeds ───────────────────────────────────────────────

const RSS_FEEDS = [
  // Core industry
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
  // High value additions
  {
    source: "Uptime Institute Journal",
    url: "https://journal.uptimeinstitute.com/feed",
  },
  {
    source: "DCNN Magazine",
    url: "https://dcnnmagazine.com/feed",
  },
  // UK & Europe focus
  {
    source: "The Stack",
    url: "https://thestack.technology/feed",
  },
  {
    source: "Silicon Republic",
    url: "https://www.siliconrepublic.com/feed",
  },
  {
    source: "Hosting Journalist",
    url: "https://www.hostingjournalist.com/feed",
  },
  {
    source: "Telecoms.com",
    url: "https://www.telecoms.com/feed",
  },
];

// ─── Entity decoder ─────────────────────────────────────────────────────────

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&apos;/g, "'")
    .replace(/&#8216;/g, "\u2018")  // left single quote '
    .replace(/&#8217;/g, "\u2019")  // right single quote '
    .replace(/&#8220;/g, "\u201C")  // left double quote "
    .replace(/&#8221;/g, "\u201D")  // right double quote "
    .replace(/&#8211;/g, "\u2013")  // en dash –
    .replace(/&#8212;/g, "\u2014")  // em dash —
    .replace(/&#\d+;/g, " ")        // any remaining numeric entities
    .replace(/&[a-z]+;/g, " ");     // any remaining named entities
}

// ─── Simple XML parser (no dependencies) ───────────────────────────────────────

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

    // Clean title — decode entities and strip any stray HTML
    const cleanTitle = decodeEntities(title)
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Clean summary — decode entities first, THEN strip tags
    const summary = desc
      ? decodeEntities(
          desc
            .replace(/<!\[CDATA\[/gi, "")
            .replace(/\]\]>/g, "")
        )
          .replace(/<[^>]+>/g, " ")         // strip HTML tags
          .replace(/[a-z-]+=(["'])[^"']*\1/gi, "") // remove attribute fragments
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 300)
      : null;

    const publishedAt = pubDate ? new Date(pubDate) : new Date();
    const now = new Date();

    // Skip if date is invalid or more than 1 hour in the future (clock skew)
    if (isNaN(publishedAt.getTime())) continue;
    if (publishedAt.getTime() > now.getTime() + 3600000) continue;

    items.push({ title: cleanTitle, url: link, summary, publishedAt, image });
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

  // Deduplicate across feeds by normalised title before inserting
  // This catches syndicated stories published at different URLs by multiple sources
  function normaliseTitle(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80); // compare first 80 chars
  }

  const seenTitles = new Set();
  const deduped = [];
  for (const item of allItems) {
    const norm = normaliseTitle(item.title);
    if (!seenTitles.has(norm)) {
      seenTitles.add(norm);
      deduped.push(item);
    }
  }

  if (deduped.length < allItems.length) {
    console.log(`📰 Deduplicated ${allItems.length - deduped.length} cross-feed duplicate(s)`);
  }

  // Insert new items, skip duplicates by URL
  let inserted = 0;
  for (const item of deduped) {
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
