import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

const INSPIRATION_EVERY = 5;

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
         u.avatar_url AS author_avatar_url
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

    const inspirationNeeded = Math.floor(entries.length / INSPIRATION_EVERY);
    let inspirations = [];
    if (inspirationNeeded > 0) {
      const insRes = await pool.query(
        `SELECT id, text, author
         FROM inspiration_quotes
         ORDER BY RANDOM()
         LIMIT $1`,
        [inspirationNeeded]
      );
      inspirations = insRes.rows;
    }

    const items = [];
    for (let i = 0; i < entries.length; i++) {
      items.push({ type: "entry", data: entries[i] });
      if ((i + 1) % INSPIRATION_EVERY === 0 && inspirations.length) {
        items.push({ type: "inspiration", data: inspirations.shift() });
      }
    }

    res.json({ items, limit, offset, hasMore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

export default router;
