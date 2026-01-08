

// // scheduler.js
// import cron from "node-cron";
// import pool from "../db/index.js";
// import { sendReminderEmail } from "./mailer.js";



// cron.schedule("* * * * *", async () => {
//   try {
//     const now = new Date();

//     const result = await pool.query(
//       `SELECT ur.*, u.email, u.name
//        FROM user_reminders ur
//        JOIN users u ON u.id = ur.user_id
//        WHERE ur.active = TRUE
//          AND EXTRACT(HOUR FROM ur.time_of_day) = $1
//          AND EXTRACT(MINUTE FROM ur.time_of_day) = $2
//          AND (ur.last_sent IS NULL OR ur.last_sent::date < CURRENT_DATE)`,
//       [now.getHours(), now.getMinutes()]
//     );

//     for (const reminder of result.rows) {
//       await sendReminderEmail(reminder.email, reminder.name);

//       await pool.query(
//         "UPDATE user_reminders SET last_sent = NOW() WHERE id = $1",
//         [reminder.id]
//       );

//       console.log(`✅ Reminder sent to user ${reminder.user_id}`);
//     }
//   } catch (err) {
//     console.error("Scheduler error:", err);
//   }
// });
