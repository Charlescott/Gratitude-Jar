import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import ensureUserSchema from "../db/ensureUserSchema.js";

const router = express.Router();

router.get("/:id/profile", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(50, Math.trunc(limitRaw)))
    : 20;
  const offset = Number.isFinite(offsetRaw)
    ? Math.max(0, Math.min(100000, Math.trunc(offsetRaw)))
    : 0;

  try {
    await ensureUserSchema(pool);
    const userRes = await pool.query(
      `SELECT id, name, email, avatar_url, is_profile_public, created_at
       FROM users WHERE id = $1`,
      [targetId]
    );
    const target = userRes.rows[0];
    if (!target) return res.status(404).json({ error: "User not found" });

    const isMe = target.id === req.user.id;

    if (!isMe) {
      const blocked = await pool.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [req.user.id, target.id]
      );
      // Hide existence from blocked counterparts.
      if (blocked.rows.length > 0) {
        return res.status(404).json({ error: "User not found" });
      }
    }

    const baseProfile = {
      id: target.id,
      name: target.name,
      avatar_url: target.avatar_url || null,
      is_profile_public: Boolean(target.is_profile_public),
      member_since: target.created_at,
      is_me: isMe,
    };

    if (!baseProfile.is_profile_public && !isMe) {
      return res.json({
        profile: baseProfile,
        entries: [],
        limit,
        offset,
        hasMore: false,
        total: 0,
      });
    }

    const totalRes = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM gratitude_entries
       WHERE user_id = $1
         AND visibility = 'public'
         AND is_anonymous = FALSE`,
      [target.id]
    );

    const entriesRes = await pool.query(
      `SELECT id, content, mood, created_at
       FROM gratitude_entries
       WHERE user_id = $1
         AND visibility = 'public'
         AND is_anonymous = FALSE
       ORDER BY created_at DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [target.id, limit + 1, offset]
    );
    const rows = entriesRes.rows || [];
    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      profile: baseProfile,
      entries,
      limit,
      offset,
      hasMore,
      total: totalRes.rows[0]?.c || 0,
    });
  } catch (err) {
    console.error("User profile error:", err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});

export default router;
