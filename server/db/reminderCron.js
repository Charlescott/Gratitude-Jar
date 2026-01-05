// cron/reminders.js
import cron from "node-cron";
import pool from "../db/index.js";
import { sendReminderEmail } from "../routes/mailer.js";

export function scheduleReminders() {
  cron.schedule("* * * * *", async () => {
    console.log("Running cron job...");

    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      const { rows: reminders } = await pool.query(
        `
        
        SELECT ur.id, ur.user_id, ur.time_of_day, u.email, u.name
        FROM user_reminders ur
        JOIN users u ON u.id = ur.user_id
        WHERE ur.active = true
          AND EXTRACT(HOUR FROM ur.time_of_day) = $1
          AND EXTRACT(MINUTE FROM ur.time_of_day) = $2
          AND (ur.last_sent IS NULL OR ur.last_sent::date < CURRENT_DATE)
        `,
        [hour, minute]
      );

      for (const reminder of reminders) {
        await sendReminderEmail(reminder.email, reminder.name);

        await pool.query(
          "UPDATE user_reminders SET last_sent = NOW() WHERE id = $1",
          [reminder.id]
        );
      }
    } catch (err) {
      console.error("Cron error:", err);
    }
  });
}
