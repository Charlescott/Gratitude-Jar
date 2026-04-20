import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import { sendNewFollowerEmail } from "./mailer.js";
import { createNotification } from "../db/notifications.js";

const router = express.Router();

router.get("/search", requireUser, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.json({ items: [] });
  }
  try {
    const pattern = `%${q}%`;
    const result = await pool.query(
      `SELECT u.id, u.email, u.name,
              EXISTS (
                SELECT 1 FROM follows f
                WHERE f.follower_id = $1 AND f.followee_id = u.id
              ) AS is_following
       FROM users u
       WHERE u.id <> $1
         AND (u.email ILIKE $2 OR u.name ILIKE $2)
       ORDER BY u.name NULLS LAST, u.email
       LIMIT 20`,
      [req.user.id, pattern]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/following", requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

router.get("/followers", requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

router.get("/status/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const result = await pool.query(
      `SELECT
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2) AS is_following,
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1) AS is_followed_by`,
      [req.user.id, targetId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch follow status" });
  }
});

router.post("/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }
  try {
    const targetUser = await pool.query(
      "SELECT id, email, name FROM users WHERE id = $1",
      [targetId]
    );
    if (!targetUser.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }
    const inserted = await pool.query(
      `INSERT INTO follows (follower_id, followee_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, followee_id) DO NOTHING
       RETURNING id`,
      [req.user.id, targetId]
    );

    res.status(201).json({ following: true });

    if (inserted.rows.length) {
      const followerRes = await pool.query(
        "SELECT name, email FROM users WHERE id = $1",
        [req.user.id]
      );
      const follower = followerRes.rows[0] || {};
      const followerDisplay =
        follower.name || follower.email || "Someone";

      try {
        await createNotification(pool, {
          userId: targetId,
          type: "new_follower",
          title: `${followerDisplay} started following you`,
          link: "/friends",
        });
      } catch (notifyErr) {
        console.error("New-follower notification failed:", notifyErr);
      }

      try {
        const unsub = await pool.query(
          "SELECT 1 FROM user_email_unsubscribes WHERE user_id = $1",
          [targetId]
        );
        if (!unsub.rows.length && targetUser.rows[0].email) {
          await sendNewFollowerEmail(targetUser.rows[0].email, {
            recipientName: targetUser.rows[0].name,
            recipientUserId: targetUser.rows[0].id,
            followerName: follower.name,
            followerEmail: follower.email,
          });
        }
      } catch (emailErr) {
        console.error("New-follower email failed:", emailErr);
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

router.delete("/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    await pool.query(
      "DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2",
      [req.user.id, targetId]
    );
    res.json({ following: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

export default router;
