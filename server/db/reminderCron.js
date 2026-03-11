// cron/reminders.js
import cron from "node-cron";
import { DateTime } from "luxon";
import pool from "../db/index.js";
import {
  sendCircleCheckInReminderEmail,
  sendReminderEmail,
} from "../routes/mailer.js";

async function ensureCircleCheckinTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS circle_checkin_reminders (
      id SERIAL PRIMARY KEY,
      circle_id INTEGER REFERENCES circles(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      last_sent TIMESTAMPTZ,
      UNIQUE (circle_id, user_id)
    );
  `);
}

async function ensureEmailUnsubscribesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_email_unsubscribes (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

function parseEnvInt(name, fallback) {
  const raw = process.env[name];
  const value = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(value) ? value : fallback;
}

export function scheduleReminders() {
  let initialized = false;

  cron.schedule("* * * * *", async () => {
    console.log("Running cron job...");

    try {
      if (!initialized) {
        try {
          await ensureCircleCheckinTables();
          await ensureEmailUnsubscribesTable();
        } catch (initErr) {
          console.error("Circle check-in init error:", initErr);
        } finally {
          initialized = true;
        }
      }

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
          AND NOT EXISTS (
            SELECT 1
            FROM user_email_unsubscribes ue
            WHERE ue.user_id = ur.user_id
          )
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

          if (isDueNow) {
            if (!alreadySentToday) {
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

            await maybeSendCircleCheckinReminder({
              userId: reminder.user_id,
              email: reminder.email,
              name: reminder.name,
              nowUtc,
            });
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

  cron.schedule(
    "0 15 * * *",
    async () => {
      try {
        if (!initialized) {
          try {
            await ensureCircleCheckinTables();
            await ensureEmailUnsubscribesTable();
          } catch (initErr) {
            console.error("Circle check-in init error:", initErr);
          } finally {
            initialized = true;
          }
        }

        const nowUtc = DateTime.utc();
        console.log("Running circle check-in job...");

        const { rows: users } = await pool.query(
          `
          SELECT DISTINCT u.id, u.email, u.name
          FROM users u
          JOIN circle_memberships cm ON cm.user_id = u.id
          WHERE NOT EXISTS (
            SELECT 1
            FROM user_email_unsubscribes ue
            WHERE ue.user_id = u.id
          )
          `
        );

        for (const user of users) {
          try {
            await maybeSendCircleCheckinReminder({
              userId: user.id,
              email: user.email,
              name: user.name,
              nowUtc,
            });
          } catch (userErr) {
            console.error(
              `Circle check-in processing failed for user ${user.id}:`,
              userErr
            );
          }
        }
      } catch (err) {
        console.error("Circle check-in cron error:", err);
      }
    },
    { timezone: "UTC" }
  );
}

async function maybeSendCircleCheckinReminder({ userId, email, name, nowUtc }) {
  const baseInactivityDays = parseEnvInt(
    "CIRCLE_CHECKIN_MIN_INACTIVITY_DAYS",
    14
  );
  const baseMinBetweenEmailsDays = parseEnvInt(
    "CIRCLE_CHECKIN_MIN_DAYS_BETWEEN_EMAILS",
    14
  );
  const jitterDays = Math.max(0, parseEnvInt("CIRCLE_CHECKIN_JITTER_DAYS", 4));
  const maxCirclesToConsider = Math.max(
    1,
    parseEnvInt("CIRCLE_CHECKIN_MAX_CANDIDATES", 3)
  );

  const jitter = jitterDays > 0 ? userId % (jitterDays + 1) : 0;
  const inactivityThresholdDays = baseInactivityDays + jitter;
  const minBetweenEmailsDays = baseMinBetweenEmailsDays + jitter;

  const { rows: circles } = await pool.query(
    `
    WITH last_any AS (
      SELECT user_id, MAX(last_sent) AS last_any_sent
      FROM circle_checkin_reminders
      GROUP BY user_id
    )
    SELECT
      cm.circle_id,
      c.name AS circle_name,
      cm.joined_at,
      MAX(ge.created_at) AS last_entry_at,
      ccr.last_sent AS last_circle_checkin_sent,
      la.last_any_sent AS last_any_checkin_sent
    FROM circle_memberships cm
    JOIN circles c ON c.id = cm.circle_id
    LEFT JOIN gratitude_entries ge
      ON ge.circle_id = cm.circle_id
     AND ge.user_id = cm.user_id
    LEFT JOIN circle_checkin_reminders ccr
      ON ccr.circle_id = cm.circle_id
     AND ccr.user_id = cm.user_id
    LEFT JOIN last_any la
      ON la.user_id = cm.user_id
    WHERE cm.user_id = $1
    GROUP BY
      cm.circle_id,
      c.name,
      cm.joined_at,
      ccr.last_sent,
      la.last_any_sent
    `,
    [userId]
  );

  if (!circles.length) return;

  const lastAnySentRaw = circles[0].last_any_checkin_sent;
  const lastAnySent = lastAnySentRaw
    ? DateTime.fromJSDate(new Date(lastAnySentRaw)).toUTC()
    : null;

  if (lastAnySent) {
    const daysSinceAny = nowUtc.diff(lastAnySent, "days").days;
    if (daysSinceAny < minBetweenEmailsDays) return;
  }

  const eligible = circles
    .map((row) => {
      const lastEntryAt = row.last_entry_at || row.joined_at;
      const lastActivity = lastEntryAt
        ? DateTime.fromJSDate(new Date(lastEntryAt)).toUTC()
        : null;

      const lastCircleSent = row.last_circle_checkin_sent
        ? DateTime.fromJSDate(new Date(row.last_circle_checkin_sent)).toUTC()
        : null;

      const inactivityDays = lastActivity
        ? nowUtc.diff(lastActivity, "days").days
        : Infinity;

      const daysSinceCircleSent = lastCircleSent
        ? nowUtc.diff(lastCircleSent, "days").days
        : Infinity;

      return {
        circleId: row.circle_id,
        circleName: row.circle_name,
        inactivityDays,
        daysSinceCircleSent,
      };
    })
    .filter(
      (row) =>
        row.circleId &&
        row.circleName &&
        row.inactivityDays >= inactivityThresholdDays &&
        row.daysSinceCircleSent >= baseMinBetweenEmailsDays
    )
    .sort((a, b) => b.inactivityDays - a.inactivityDays);

  if (!eligible.length) return;

  const candidates = eligible.slice(0, maxCirclesToConsider);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];

  await sendCircleCheckInReminderEmail(email, {
    recipientName: name,
    circleName: selected.circleName,
    circleId: selected.circleId,
    userId,
  });

  await pool.query(
    `
    INSERT INTO circle_checkin_reminders (circle_id, user_id, last_sent)
    VALUES ($1, $2, NOW())
    ON CONFLICT (circle_id, user_id)
    DO UPDATE SET last_sent = EXCLUDED.last_sent
    `,
    [selected.circleId, userId]
  );
}
