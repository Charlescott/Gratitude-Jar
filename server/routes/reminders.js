// routes/reminders.js
import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

// Create or update reminder
router.post("/", requireUser, async (req, res) => {
  const { frequency, time_of_day, active } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `INSERT INTO user_reminders (user_id, frequency, time_of_day, active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) 
       DO UPDATE SET frequency = $2, time_of_day = $3, active = $4
       RETURNING *`,
      [userId, frequency, time_of_day, active]
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

export default router;
