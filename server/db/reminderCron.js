// cron/reminders.js
import cron from "node-cron";
import pool from "../db/index.js";
import { sendReminderEmail } from "../routes/mailer.js";

export function scheduleReminders() {
  cron.schedule("* * * * *", async () => {
    console.log("Running cron job...");

    try {
      const nowUtc = new Date();

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
          `Sending reminder to user ${reminder.user_id} at ${reminder.hour}:${reminder.minute}`
        );
        const userNow = new Date(
          nowUtc.toLocaleString("en-US", {
            timeZone: reminder.timezone || "UTC",
          })
        );

        const [reminderHour, reminderMinute] = reminder.time_of_day
          .split(":")
          .map(Number);

        const hour = userNow.getHours();
        const minute = userNow.getMinutes();

        const alreadySentToday =
          reminder.last_sent &&
          new Date(reminder.last_sent).toDateString() ===
            userNow.toDateString();

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
