import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

const INSPIRATION_EVERY = 4;
const NEWS_EVERY = 3;

router.get("/", requireUser, async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.trunc(limitRaw)))
    : 20;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.min(100000, Math.trunc(offsetRaw)))
    : 0;

  try {
    const entriesRes = await pool.query(
      `SELECT
         ge.id,
         ge.content,
         ge.mood,
         ge.visibility,
         ge.is_anonymous,
         ge.created_at,
         ge.user_id,
         u.name AS author_name,
         u.email AS author_email,
         u.avatar_url AS author_avatar_url,
         COALESCE(
           (SELECT jsonb_object_agg(emoji, c)
            FROM (
              SELECT emoji, COUNT(*)::int AS c
              FROM entry_reactions er
              WHERE er.entry_id = ge.id
              GROUP BY emoji
            ) agg),
           '{}'::jsonb
         ) AS reactions,
         (SELECT emoji FROM entry_reactions
          WHERE entry_id = ge.id AND user_id = $1) AS my_reaction
       FROM gratitude_entries ge
       JOIN users u ON u.id = ge.user_id
       WHERE (
         ge.visibility = 'public'
         OR (
           ge.visibility = 'friends' AND (
             ge.user_id = $1
             OR EXISTS (
               SELECT 1 FROM follows f
               WHERE f.follower_id = $1 AND f.followee_id = ge.user_id
             )
           )
         )
       )
       ORDER BY ge.created_at DESC, ge.id DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit + 1, offset]
    );

    const rows = entriesRes.rows || [];
    const hasMore = rows.length > limit;
    const entries = (hasMore ? rows.slice(0, limit) : rows).map((row) => {
      const isMine = row.user_id === req.user.id;
      if (row.is_anonymous && !isMine) {
        return {
          ...row,
          author_name: null,
          author_email: null,
          author_avatar_url: null,
          user_id: null,
          is_mine: false,
        };
      }
      return { ...row, is_mine: isMine };
    });

    // Independent cadence: news every NEWS_EVERY entries, plus one upfront
    // when there are any entries at all so a young feed doesn't look bare.
    // Inspirations every INSPIRATION_EVERY entries.
    const newsNeeded =
      entries.length > 0
        ? 1 + Math.floor(entries.length / NEWS_EVERY)
        : 0;
    const inspirationNeeded = Math.floor(entries.length / INSPIRATION_EVERY);

    const [newsRes, insRes] = await Promise.all([
      newsNeeded > 0
        ? pool.query(
            `SELECT id, title, summary, url, image_url, source, published_at
             FROM (
               SELECT id, title, summary, url, image_url, source, published_at
               FROM news_stories
               WHERE hidden = FALSE
               ORDER BY published_at DESC NULLS LAST, id DESC
               LIMIT 60
             ) recent
             ORDER BY RANDOM()
             LIMIT $1`,
            [newsNeeded]
          )
        : Promise.resolve({ rows: [] }),
      inspirationNeeded > 0
        ? pool.query(
            `SELECT id, text, author
             FROM inspiration_quotes
             ORDER BY RANDOM()
             LIMIT $1`,
            [inspirationNeeded]
          )
        : Promise.resolve({ rows: [] }),
    ]);
    const newsQueue = newsRes.rows.map((r) => ({ type: "news", data: r }));
    const inspirationQueue = insRes.rows.map((r) => ({
      type: "inspiration",
      data: r,
    }));

    const items = [];
    // Lead with a news card if we have one and have any entries to show.
    if (entries.length > 0 && newsQueue.length) {
      items.push(newsQueue.shift());
    }
    for (let i = 0; i < entries.length; i++) {
      items.push({ type: "entry", data: entries[i] });
      const pos = i + 1;
      if (pos % NEWS_EVERY === 0 && newsQueue.length) {
        items.push(newsQueue.shift());
      }
      if (pos % INSPIRATION_EVERY === 0 && inspirationQueue.length) {
        items.push(inspirationQueue.shift());
      }
    }

    res.json({ items, limit, offset, hasMore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

export default router;
