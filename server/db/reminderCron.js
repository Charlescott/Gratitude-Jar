// cron/reminders.js
import cron from "node-cron";
import pool from "../db/index.js"; // safe if db is independent
import { sendReminderEmail } from "../routes/mailer.js";

export function scheduleReminders() {
  cron.schedule("*/1 * * * *", async () => {
    try {
      console.log("Running cron job...");

      const { rows: users } = await pool.query(
        "SELECT email FROM users WHERE email IS NOT NULL"
      );

      for (const user of users) {
        await sendReminderEmail(
          user.email,
          "It's time to add a gratitude entry 🌱"
        );
      }
    } catch (err) {
      console.error("Cron error:", err);
    }
  });
}

