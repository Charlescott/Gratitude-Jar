import dotenv from "dotenv";
dotenv.config({
  path: process.env.NODE_ENV === "production" ? ".env" : ".env.local",
});

import pool from "./db/index.js";
import { sendCircleCheckInReminderEmail } from "./routes/mailer.js";

const TARGET_EMAIL = "scottfairdosi@yahoo.com";

async function main() {
  const { rows: userRows } = await pool.query(
    "SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [TARGET_EMAIL]
  );
  if (!userRows.length) {
    throw new Error(`No user found with email ${TARGET_EMAIL}`);
  }
  const user = userRows[0];

  const { rows: circleRows } = await pool.query(
    `SELECT c.id, c.name
     FROM circle_memberships cm
     JOIN circles c ON c.id = cm.circle_id
     WHERE cm.user_id = $1
     ORDER BY cm.joined_at ASC
     LIMIT 1`,
    [user.id]
  );

  const circle = circleRows[0] || { id: 0, name: "your circle" };

  console.log(
    `Sending check-in email to ${user.email} (user ${user.id}) for circle "${circle.name}" (${circle.id})...`
  );

  await sendCircleCheckInReminderEmail(user.email, {
    recipientName: user.name,
    circleName: circle.name,
    circleId: circle.id,
    userId: user.id,
  });

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error("Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
