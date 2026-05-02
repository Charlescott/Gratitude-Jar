import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

router.get("/", requireUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url, b.created_at AS blocked_at
       FROM user_blocks b
       JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load blocks" });
  }
});

router.post("/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Cannot block yourself" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Remove follows in either direction.
    await client.query(
      `DELETE FROM follows
       WHERE (follower_id = $1 AND followee_id = $2)
          OR (follower_id = $2 AND followee_id = $1)`,
      [req.user.id, targetId]
    );

    // Cancel any pending follow requests in either direction.
    await client.query(
      `DELETE FROM follow_requests
       WHERE ((requester_id = $1 AND requestee_id = $2)
           OR (requester_id = $2 AND requestee_id = $1))
         AND status = 'pending'`,
      [req.user.id, targetId]
    );

    await client.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.user.id, targetId]
    );

    await client.query("COMMIT");
    res.status(201).json({ status: "blocked" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to block user" });
  } finally {
    client.release();
  }
});

router.delete("/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    await pool.query(
      `DELETE FROM user_blocks
       WHERE blocker_id = $1 AND blocked_id = $2`,
      [req.user.id, targetId]
    );
    res.json({ status: "unblocked" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

export default router;
