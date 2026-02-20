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
        try {
          console.log(
            `Checking reminder ${reminder.id} for user ${reminder.user_id} at ${reminder.time_of_day} (${reminder.timezone})`
          );

          const requestedZone = reminder.timezone || "UTC";
          let userNow = nowUtc.setZone(requestedZone);
          let effectiveZone = requestedZone;
          if (!userNow.isValid) {
            console.warn(
              `Invalid timezone "${requestedZone}" for user ${reminder.user_id}; falling back to UTC`
            );
            userNow = nowUtc.setZone("UTC");
            effectiveZone = "UTC";
          }

          const [reminderHourRaw, reminderMinuteRaw] = String(
            reminder.time_of_day
          )
            .split(":")
            .map(Number);

          if (
            Number.isNaN(reminderHourRaw) ||
            Number.isNaN(reminderMinuteRaw)
          ) {
            console.warn(
              `Invalid reminder time "${reminder.time_of_day}" for user ${reminder.user_id}; skipping`
            );
            continue;
          }

          const reminderHour = Math.max(0, Math.min(23, reminderHourRaw));
          const reminderMinute = Math.max(0, Math.min(59, reminderMinuteRaw));

          const alreadySentToday = reminder.last_sent
            ? DateTime.fromJSDate(new Date(reminder.last_sent))
                .setZone(effectiveZone)
                .hasSame(userNow, "day")
            : false;

          const reminderNow = userNow.set({
            hour: reminderHour,
            minute: reminderMinute,
            second: 0,
            millisecond: 0,
          });

          const minutesSinceReminder = userNow.diff(reminderNow, "minutes")
            .minutes;
          const isDueNow =
            minutesSinceReminder >= 0 && minutesSinceReminder < 2;

          if (isDueNow && !alreadySentToday) {
            console.log(
              `Time matches for user ${reminder.user_id}. Sending email...`
            );

            await sendReminderEmail(reminder.email, reminder.name, {
              userId: reminder.user_id,
            });

            await pool.query(
              "UPDATE user_reminders SET last_sent = NOW() WHERE id = $1",
              [reminder.id]
            );
          }
        } catch (reminderErr) {
          console.error(
            `Reminder processing failed for reminder ${reminder.id}:`,
            reminderErr
          );
        }
      }
    } catch (err) {
      console.error("Cron error:", err);
    }
  });
}
