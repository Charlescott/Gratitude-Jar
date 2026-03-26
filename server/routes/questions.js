import express from "express";
import pool from "../db/index.js";

const router = express.Router();

router.get("/random", async (req, res) => {
  try {
    const countResult = await pool.query(
      "SELECT COUNT(*)::int AS count FROM questions"
    );
    const count = countResult.rows?.[0]?.count || 0;
    if (count <= 0) {
      return res.status(404).json({ error: "No questions found" });
    }

    const offset = Math.floor(Math.random() * count);
    const result = await pool.query(
      "SELECT * FROM questions ORDER BY id ASC OFFSET $1 LIMIT 1",
      [offset]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch question" });
  }
});

export default router;
