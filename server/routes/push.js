import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import { getVapidPublicKey, isPushConfigured } from "../lib/push.js";

const router = express.Router();

router.get("/vapid-public-key", (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push not configured" });
  }
  res.json({ key: getVapidPublicKey() });
});

router.post("/subscribe", requireUser, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push not configured" });
  }
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );
    res.json({ status: "subscribed" });
  } catch (err) {
    console.error("Push subscribe error:", err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

router.post("/unsubscribe", requireUser, async (req, res) => {
  const { endpoint } = req.body || {};
  try {
    if (endpoint) {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [req.user.id, endpoint]
      );
    } else {
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1`,
        [req.user.id]
      );
    }
    res.json({ status: "unsubscribed" });
  } catch (err) {
    console.error("Push unsubscribe error:", err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

export default router;
