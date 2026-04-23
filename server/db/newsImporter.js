import Parser from "rss-parser";
import pool from "./index.js";

const parser = new Parser({
  timeout: 15000,
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
    ],
  },
});

const SOURCES = [
  { name: "Good News Network", url: "https://www.goodnewsnetwork.org/feed/" },
  { name: "Positive News", url: "https://www.positive.news/feed/" },
  { name: "The Optimist Daily", url: "https://www.optimistdaily.com/feed/" },
  {
    name: "Reasons to be Cheerful",
    url: "https://reasonstobecheerful.world/feed/",
  },
  { name: "Yes! Magazine", url: "https://www.yesmagazine.org/feed" },
];

const BLOCK_KEYWORDS = [
  // crude tone filter — drop anything obviously off-vibe
  "death",
  "dies",
  "killed",
  "murder",
  "tragedy",
  "war",
  "shooting",
];

function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickImageUrl(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item.mediaThumbnail?.$?.url) return item.mediaThumbnail.$.url;
  if (item.mediaContent?.$?.url) return item.mediaContent.$.url;
  if (item["content:encoded"]) {
    const m = String(item["content:encoded"]).match(
      /<img[^>]+src=["']([^"']+)["']/i
    );
    if (m) return m[1];
  }
  return null;
}

function shouldSkip(title, summary) {
  const blob = `${title} ${summary || ""}`.toLowerCase();
  return BLOCK_KEYWORDS.some((kw) => blob.includes(kw));
}

async function importSource(source) {
  let feed;
  try {
    feed = await parser.parseURL(source.url);
  } catch (err) {
    console.warn(`News import failed for ${source.name}:`, err.message);
    return { source: source.name, inserted: 0, skipped: 0 };
  }

  let inserted = 0;
  let skipped = 0;
  for (const item of feed.items || []) {
    const title = (item.title || "").trim();
    const url = (item.link || "").trim();
    if (!title || !url) {
      skipped++;
      continue;
    }
    const summary = stripHtml(
      item.contentSnippet || item.summary || item.content || ""
    ).slice(0, 280);

    if (shouldSkip(title, summary)) {
      skipped++;
      continue;
    }

    const image = pickImageUrl(item);
    const publishedAt = item.isoDate ? new Date(item.isoDate) : null;

    try {
      const res = await pool.query(
        `INSERT INTO news_stories
          (title, summary, url, image_url, source, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO NOTHING`,
        [title, summary || null, url, image, source.name, publishedAt]
      );
      if (res.rowCount > 0) inserted++;
    } catch (err) {
      console.warn(`News insert failed for "${title}":`, err.message);
    }
  }
  return { source: source.name, inserted, skipped };
}

export async function importAllNews() {
  const results = [];
  for (const source of SOURCES) {
    const r = await importSource(source);
    results.push(r);
  }
  const totalInserted = results.reduce((sum, r) => sum + r.inserted, 0);
  console.log(
    `News import done: ${totalInserted} new stories`,
    results.map((r) => `${r.source}=${r.inserted}`).join(", ")
  );
  return results;
}
