import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import { fanOutToFollowers } from "../db/notifications.js";

const router = express.Router();

router.get("/", requireUser, async (req, res) => {
  try {
    const limitRaw = req.query.limit;
    const offsetRaw = req.query.offset;
    const requestedLimit = limitRaw == null ? 50 : Number(limitRaw);
    const requestedOffset = offsetRaw == null ? 0 : Number(offsetRaw);

    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(200, Math.trunc(requestedLimit)))
      : 50;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, Math.min(100000, Math.trunc(requestedOffset)))
      : 0;

    const result = await pool.query(
      "SELECT * FROM gratitude_entries WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit + 1, offset]
    );
    const rows = result.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    res.json({ items, limit, offset, hasMore });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

router.get("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM gratitude_entries WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

const ALLOWED_VISIBILITIES = new Set(["private", "friends", "public"]);

function normalizeVisibility(value, fallback = "private") {
  if (value == null) return fallback;
  const v = String(value).trim().toLowerCase();
  return ALLOWED_VISIBILITIES.has(v) ? v : fallback;
}

router.post("/", requireUser, async (req, res) => {
  const content = req.body.content?.trim();
  const mood = req.body.mood?.trim();
  const visibility = normalizeVisibility(req.body.visibility, "private");
  const isAnonymous =
    Boolean(req.body.is_anonymous) && visibility !== "private";

  if (!content) {
    return res.status(400).json({ error: "Content is required" });
  }
  try {
    const result = await pool.query(
      "INSERT INTO gratitude_entries (user_id, content, mood, visibility, is_anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.user.id, content, mood || null, visibility, isAnonymous]
    );

    res.status(201).json(result.rows[0]);

    if (visibility !== "private") {
      try {
        let authorDisplay = "Someone";
        if (!isAnonymous) {
          const authorRes = await pool.query(
            "SELECT name, email FROM users WHERE id = $1",
            [req.user.id]
          );
          const author = authorRes.rows[0] || {};
          authorDisplay = author.name || author.email || "Someone";
        } else {
          authorDisplay = "Anonymous";
        }
        const preview = content.slice(0, 140);

        await fanOutToFollowers(pool, {
          followeeId: req.user.id,
          type: "friend_post",
          title: `${authorDisplay} shared a gratitude`,
          body: preview,
          link: "/feed",
        });
      } catch (fanOutErr) {
        console.error("Friend-post fan-out failed:", fanOutErr);
      }
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

router.put("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const currentRes = await pool.query(
      "SELECT content, mood, visibility, is_anonymous FROM gratitude_entries WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (!currentRes.rows.length) {
      return res.status(404).json({ error: "Entry not found" });
    }
    const current = currentRes.rows[0];

    const content =
      req.body.content !== undefined
        ? String(req.body.content).trim()
        : current.content;
    if (!content) {
      return res.status(400).json({ error: "Content is required" });
    }
    const mood =
      req.body.mood !== undefined ? req.body.mood || null : current.mood;
    const visibility = Object.prototype.hasOwnProperty.call(
      req.body,
      "visibility"
    )
      ? normalizeVisibility(req.body.visibility, current.visibility)
      : current.visibility;
    const requestedAnonymous = Object.prototype.hasOwnProperty.call(
      req.body,
      "is_anonymous"
    )
      ? Boolean(req.body.is_anonymous)
      : Boolean(current.is_anonymous);
    const isAnonymous = requestedAnonymous && visibility !== "private";

    const result = await pool.query(
      "UPDATE gratitude_entries SET content = $1, mood = $2, visibility = $3, is_anonymous = $4, updated_at = NOW() WHERE id = $5 AND user_id = $6 RETURNING *",
      [content, mood, visibility, isAnonymous, id, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

router.delete("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM gratitude_entries WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Entry not found" });
    res.json({ message: "Entry deleted", entry: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
