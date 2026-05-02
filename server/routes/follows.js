import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import {
  sendNewFollowerEmail,
  sendFollowRequestEmail,
  sendFriendInviteEmail,
} from "./mailer.js";
import { createNotification } from "../db/notifications.js";

const router = express.Router();

async function checkBlock(viewerId, otherId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [viewerId, otherId]
  );
  return rows.length > 0;
}

router.get("/search", requireUser, async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return res.json({ items: [] });
  }
  try {
    const pattern = `%${q}%`;
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.avatar_url,
              EXISTS (
                SELECT 1 FROM follows f
                WHERE f.follower_id = $1 AND f.followee_id = u.id
              ) AS is_following,
              EXISTS (
                SELECT 1 FROM follow_requests fr
                WHERE fr.requester_id = $1 AND fr.requestee_id = u.id
                  AND fr.status = 'pending'
              ) AS request_pending
       FROM users u
       WHERE u.id <> $1
         AND (u.email ILIKE $2 OR u.name ILIKE $2)
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
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
      `SELECT u.id, u.email, u.name, u.avatar_url, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.followee_id
       WHERE f.follower_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
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
      `SELECT u.id, u.email, u.name, u.avatar_url, f.created_at AS followed_at
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks b
           WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
              OR (b.blocker_id = u.id AND b.blocked_id = $1)
         )
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

router.get("/requests", requireUser, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT fr.id AS request_id, fr.created_at AS requested_at,
              u.id, u.email, u.name, u.avatar_url
       FROM follow_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.requestee_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.user.id]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch follow requests" });
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
         EXISTS (SELECT 1 FROM follows WHERE follower_id = $2 AND followee_id = $1) AS is_followed_by,
         EXISTS (SELECT 1 FROM follow_requests
                 WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending') AS request_pending,
         EXISTS (SELECT 1 FROM user_blocks
                 WHERE blocker_id = $1 AND blocked_id = $2) AS i_blocked,
         EXISTS (SELECT 1 FROM user_blocks
                 WHERE blocker_id = $2 AND blocked_id = $1) AS blocked_me`,
      [req.user.id, targetId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch follow status" });
  }
});

// Create a follow REQUEST (not an immediate follow). Idempotent.
router.post("/:userId", requireUser, async (req, res) => {
  const targetId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(targetId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (targetId === req.user.id) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }
  try {
    if (await checkBlock(req.user.id, targetId)) {
      return res.status(403).json({ error: "Blocked" });
    }

    const targetUser = await pool.query(
      "SELECT id, email, name FROM users WHERE id = $1",
      [targetId]
    );
    if (!targetUser.rows.length) {
      return res.status(404).json({ error: "User not found" });
    }

    // Already following — no-op.
    const already = await pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2",
      [req.user.id, targetId]
    );
    if (already.rowCount) {
      return res.json({ status: "following" });
    }

    // Already pending — no-op.
    const pending = await pool.query(
      `SELECT 1 FROM follow_requests
       WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending'`,
      [req.user.id, targetId]
    );
    if (pending.rowCount) {
      return res.json({ status: "pending" });
    }

    await pool.query(
      `INSERT INTO follow_requests (requester_id, requestee_id, status, updated_at)
       VALUES ($1, $2, 'pending', NOW())`,
      [req.user.id, targetId]
    );

    res.status(201).json({ status: "pending" });

    // Notify the requestee (in-app + email)
    try {
      const requesterRes = await pool.query(
        "SELECT name, email FROM users WHERE id = $1",
        [req.user.id]
      );
      const requester = requesterRes.rows[0] || {};
      const requesterDisplay = requester.name || requester.email || "Someone";
      await createNotification(pool, {
        userId: targetId,
        type: "follow_request",
        title: `${requesterDisplay} requested to follow you`,
        link: "/friends",
      });

      const target = targetUser.rows[0];
      const unsub = await pool.query(
        "SELECT 1 FROM user_email_unsubscribes WHERE user_id = $1",
        [targetId]
      );
      if (!unsub.rows.length && target.email) {
        const appBaseUrl = (
          process.env.APP_URL || "https://thegratitudejar.net"
        ).replace(/\/$/, "");
        await sendFollowRequestEmail(target.email, {
          recipientName: target.name,
          recipientUserId: target.id,
          requesterName: requester.name,
          requesterEmail: requester.email,
          inviteUrl: `${appBaseUrl}/friends`,
        });
      }
    } catch (notifyErr) {
      console.error("Follow-request notification failed:", notifyErr);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send follow request" });
  }
});

// Cancel an outgoing follow request (or unfollow if already accepted).
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
    await pool.query(
      `DELETE FROM follow_requests
       WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending'`,
      [req.user.id, targetId]
    );
    res.json({ status: "none" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unfollow" });
  }
});

// Accept an incoming follow request.
router.post("/requests/:userId/accept", requireUser, async (req, res) => {
  const requesterId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(requesterId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    if (await checkBlock(req.user.id, requesterId)) {
      return res.status(409).json({ error: "Cannot accept — blocked" });
    }

    const reqRow = await pool.query(
      `SELECT id FROM follow_requests
       WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending'`,
      [requesterId, req.user.id]
    );
    if (!reqRow.rowCount) {
      return res.status(404).json({ error: "No pending request found" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO follows (follower_id, followee_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, followee_id) DO NOTHING`,
        [requesterId, req.user.id]
      );
      await client.query(
        `UPDATE follow_requests
         SET status = 'accepted', updated_at = NOW()
         WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending'`,
        [requesterId, req.user.id]
      );
      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }

    res.json({ status: "accepted" });

    // Notify the requester (the existing "new_follower" notification, relocated here)
    try {
      const accepterRes = await pool.query(
        "SELECT name, email FROM users WHERE id = $1",
        [req.user.id]
      );
      const requesterRes = await pool.query(
        "SELECT id, email, name FROM users WHERE id = $1",
        [requesterId]
      );
      const accepter = accepterRes.rows[0] || {};
      const requester = requesterRes.rows[0] || {};
      const accepterDisplay = accepter.name || accepter.email || "Someone";

      await createNotification(pool, {
        userId: requesterId,
        type: "new_follower",
        title: `${accepterDisplay} accepted your follow request`,
        link: "/friends",
      });

      // Email — same as the legacy new-follower email
      const unsub = await pool.query(
        "SELECT 1 FROM user_email_unsubscribes WHERE user_id = $1",
        [requesterId]
      );
      if (!unsub.rows.length && requester.email) {
        await sendNewFollowerEmail(requester.email, {
          recipientName: requester.name,
          recipientUserId: requester.id,
          followerName: accepter.name,
          followerEmail: accepter.email,
        });
      }
    } catch (notifyErr) {
      console.error("Follow-accept notification failed:", notifyErr);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request" });
  }
});

// Send an invitation email to a non-user, OR auto-create a follow request
// if the email already belongs to a registered user.
router.post("/invite", requireUser, async (req, res) => {
  const rawEmail = String(req.body?.email || "").trim().toLowerCase();
  if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
    return res.status(400).json({ error: "Valid email required" });
  }

  try {
    const inviterRes = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [req.user.id]
    );
    const inviter = inviterRes.rows[0];
    if (!inviter) return res.status(404).json({ error: "User not found" });
    if (rawEmail === inviter.email) {
      return res.status(400).json({ error: "Cannot invite yourself" });
    }

    // Existing user? Convert into a follow request.
    const existing = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [rawEmail]
    );
    if (existing.rows.length > 0) {
      return res.json({
        status: "user_exists",
        user_id: existing.rows[0].id,
      });
    }

    const appBaseUrl = (
      process.env.APP_URL || "https://thegratitudejar.net"
    ).replace(/\/$/, "");
    const inviteUrl = `${appBaseUrl}/register?invite=${inviter.id}`;

    await sendFriendInviteEmail(rawEmail, {
      inviterName: inviter.name,
      inviterEmail: inviter.email,
      inviteUrl,
    });

    res.json({ status: "invited" });
  } catch (err) {
    console.error("Invite error:", err);
    res.status(500).json({ error: "Failed to send invite" });
  }
});

// Deny an incoming follow request — silent, per user preference.
router.post("/requests/:userId/deny", requireUser, async (req, res) => {
  const requesterId = Number.parseInt(req.params.userId, 10);
  if (!Number.isFinite(requesterId)) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  try {
    const result = await pool.query(
      `DELETE FROM follow_requests
       WHERE requester_id = $1 AND requestee_id = $2 AND status = 'pending'`,
      [requesterId, req.user.id]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "No pending request found" });
    }
    res.json({ status: "denied" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to deny request" });
  }
});

export default router;
