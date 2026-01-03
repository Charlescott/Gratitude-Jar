// scheduler.js
import cron from "node-cron";
import pool from "./db/index.js";
import { sendReminderEmail } from "./mailer.js";
import { DateTime } from "luxon";

// Run every minute
cron.schedule("* * * * *", async () => {
  try {
    const now = DateTime.local(); // server local time
    const currentHour = now.hour;
    const currentMinute = now.minute;

    console.log(`[${now.toISO()}] Checking reminders for ${currentHour}:${currentMinute}`);

    const result = await pool.query(
      `SELECT ur.*, u.email, u.name
       FROM user_reminders ur
       JOIN users u ON u.id = ur.user_id
       WHERE ur.active = TRUE
         AND EXTRACT(HOUR FROM ur.time_of_day) = $1
         AND EXTRACT(MINUTE FROM ur.time_of_day) = $2
         AND (ur.last_sent IS NULL OR ur.last_sent::date < NOW()::date)`,
      [currentHour, currentMinute]
    );

    if (result.rows.length === 0) {
      console.log("No reminders to send right now.");
      return;
    }

    for (let reminder of result.rows) {
      try {
        await sendReminderEmail(reminder.email, reminder.name);
        await pool.query(
          "UPDATE user_reminders SET last_sent = NOW() WHERE id = $1",
          [reminder.id]
        );
        console.log(`✅ Reminder sent to ${reminder.email}`);
      } catch (err) {
        console.error("Failed to send reminder for user:", reminder.user_id, err);
      }
    }
  } catch (err) {
    console.error("Error in reminder scheduler:", err);
  }
});
