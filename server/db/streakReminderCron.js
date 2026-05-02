import cron from "node-cron";
import pool from "./index.js";
import { computeStreak } from "./streak.js";
import { isPushConfigured, sendPushToUser } from "../lib/push.js";

let started = false;

async function sendStreakReminders() {
  if (!isPushConfigured()) return;

  // Find users with at least one push subscription. Compute their streak; send a
  // reminder only if the streak is alive but they haven't posted today.
  const { rows: subscribers } = await pool.query(
    `SELECT DISTINCT user_id FROM push_subscriptions`
  );

  const today = new Date().toISOString().slice(0, 10);
  let sentCount = 0;

  for (const { user_id } of subscribers) {
    try {
      const streak = await computeStreak(user_id);
      // Skip: no streak, or already posted today, or streak is very fresh (<2)
      if (!streak.current || streak.current < 2) continue;
      if (streak.last_post_date === today) continue;

      const title = "Keep your streak alive 🔥";
      const message = streak.freeze_used
        ? `You've used your freeze on a ${streak.current}-day streak — post today or it breaks tomorrow.`
        : `Don't break your ${streak.current}-day streak — share something you're grateful for.`;

      await sendPushToUser(user_id, {
        title,
        body: message,
        url: "/feed",
      });
      sentCount++;
    } catch (err) {
      console.error(`Streak reminder error for user ${user_id}:`, err);
    }
  }

  if (sentCount > 0) {
    console.log(`Streak reminder pushes sent: ${sentCount}`);
  }
}

export function scheduleStreakReminders() {
  if (started) return;
  started = true;

  // 11 PM UTC daily — late evening for most US/EU timezones, before midnight UTC
  // when streaks would actually break.
  cron.schedule("0 23 * * *", () => {
    sendStreakReminders().catch((err) =>
      console.error("Streak reminder run failed:", err)
    );
  });
}
