import webpush from "web-push";
import pool from "../db/index.js";

let configured = null;

export function isPushConfigured() {
  if (configured !== null) return configured;
  const {
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
  } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    configured = false;
    return false;
  }
  webpush.setVapidDetails(
    VAPID_SUBJECT || "mailto:support@thegratitudejar.net",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function sendPushToUser(userId, payload) {
  if (!isPushConfigured()) return { sent: 0, removed: 0 };

  const { rows } = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  let sent = 0;
  let removed = 0;
  const body = JSON.stringify(payload);

  for (const row of rows) {
    const subscription = {
      endpoint: row.endpoint,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      await webpush.sendNotification(subscription, body);
      sent++;
    } catch (err) {
      // 404 / 410 = subscription expired; clean it up.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query(`DELETE FROM push_subscriptions WHERE id = $1`, [
          row.id,
        ]);
        removed++;
      } else {
        console.warn(
          `Push send failed for user ${userId} endpoint ${row.endpoint.slice(0, 40)}…:`,
          err.statusCode || err.message
        );
      }
    }
  }
  return { sent, removed };
}
