// cron/reminders.js
import cron from "node-cron";
import { DateTime } from "luxon";
import pool from "../db/index.js";
import { sendReminderEmail } from "../routes/mailer.js";

export function scheduleReminders() {
  cron.schedule("* * * * *", async () => {
    console.log("Running cron job...");

    try {
      const nowUtc = DateTime.utc();

      const { rows: reminders } = await pool.query(
        `
        SELECT 
          ur.id,
          ur.user_id,
          ur.time_of_day,
          ur.timezone,
          ur.last_sent,
          u.email,
          u.name
        FROM user_reminders ur
        JOIN users u ON u.id = ur.user_id
        WHERE ur.active = true
        `
      );

      for (const reminder of reminders) {
        console.log(
          `Checking reminder ${reminder.id} for user ${reminder.user_id} at ${reminder.time_of_day} (${reminder.timezone})`
        );

        const zone = reminder.timezone || "UTC";
        const userNow = nowUtc.setZone(zone);
        if (!userNow.isValid) {
          console.warn(
            `Invalid timezone "${zone}" for user ${reminder.user_id}; skipping reminder ${reminder.id}`
          );
          continue;
        }

        const [reminderHour, reminderMinute] = reminder.time_of_day
          .split(":")
          .map(Number);

        const hour = userNow.hour;
        const minute = userNow.minute;

        const alreadySentToday = reminder.last_sent
          ? DateTime.fromJSDate(new Date(reminder.last_sent))
              .setZone(zone)
              .hasSame(userNow, "day")
          : false;

        if (
          hour === reminderHour &&
          minute === reminderMinute &&
          !alreadySentToday
        ) {
          console.log(
            `Time matches for user ${reminder.user_id}. Sending email...`
          );

          await sendReminderEmail(reminder.email, reminder.name);

          await pool.query(
            "UPDATE user_reminders SET last_sent = NOW() WHERE id = $1",
            [reminder.id]
          );
        }
      }
    } catch (err) {
      console.error("Cron error:", err);
    }
  });
}
