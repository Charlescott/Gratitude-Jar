// routes/reminders.js
import express from "express";
import jwt from "jsonwebtoken";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

// Create or update reminder
router.post("/", requireUser, async (req, res) => {
  const { frequency, time_of_day, active, timezone } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO user_reminders (user_id, frequency, time_of_day, active, timezone)
       VALUES ($1, $2, $3, $4, COALESCE(NULLIF($5, ''), 'UTC'))
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         frequency = $2,
         time_of_day = $3,
         active = $4,
         timezone = COALESCE(NULLIF($5, ''), user_reminders.timezone, 'UTC')
       RETURNING *`,
      [userId, frequency, time_of_day, active, timezone || null]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save reminder" });
  }
});

router.get("/", requireUser, async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      "SELECT * FROM user_reminders WHERE user_id = $1",
      [userId]
    );

    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reminder" });
  }
});

async function handleUnsubscribe(req, res) {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send("Missing unsubscribe token.");
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.typ !== "reminder_unsubscribe" || !payload?.uid) {
      return res.status(400).send("Invalid unsubscribe token.");
    }

    await pool.query(
      "UPDATE user_reminders SET active = false WHERE user_id = $1",
      [payload.uid]
    );

    const html = `
      <html>
        <head><title>Unsubscribed</title></head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>You are unsubscribed</h2>
          <p>Email reminders have been turned off for your account.</p>
        </body>
      </html>
    `;

    return res.status(200).send(html);
  } catch (err) {
    console.error("Unsubscribe error:", err);
    return res.status(400).send("Invalid or expired unsubscribe token.");
  }
}

router.get("/unsubscribe", handleUnsubscribe);
router.post("/unsubscribe", handleUnsubscribe);

export default router;
