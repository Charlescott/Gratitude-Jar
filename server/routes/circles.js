import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

function generateKey() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

router.post("/", requireUser, async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: "Circle name required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const key = generateKey();

    const circleResult = await client.query(
      `INSERT INTO circles (name, key, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), key, req.user.id],
    );

    const circle = circleResult.rows[0];

    await client.query(
      `INSERT INTO circle_memberships (circle_id, user_id)
       VALUES ($1, $2)`,
      [circle.id, req.user.id],
    );

    await client.query("COMMIT");
    res.status(201).json(circle);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create circle" });
  } finally {
    client.release();
  }
});

router.get("/", requireUser, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT c.*
      FROM circles c
      JOIN circle_memberships m ON m.circle_id = c.id
      WHERE m.user_id = $1
      ORDER BY c.created_at DESC
      `,
      [req.user.id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch circles" });
  }
});

router.post("/join", requireUser, async (req, res) => {
  const { key } = req.body;

  try {
    const circleResult = await pool.query(
      "SELECT * FROM circles WHERE key = $1",
      [key],
    );

    if (circleResult.rows.length === 0) {
      return res.status(404).json({ error: "Circle not found" });
    }

    const circle = circleResult.rows[0];

    await pool.query(
      `INSERT INTO circle_memberships (circle_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [circle.id, req.user.id],
    );

    res.json(circle);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to join circle" });
  }
});

// GET /circles/:id
router.get("/:id", requireUser, async (req, res) => {
  const { id } = req.params;

  try {
    const circleResult = await pool.query(
      `
      SELECT c.id, c.name, c.owner_id,
             COUNT(cm.user_id) AS member_count
      FROM circles c
      LEFT JOIN circle_memberships cm ON c.id = cm.circle_id
      WHERE c.id = $1
      GROUP BY c.id
      `,
      [id],
    );

    if (circleResult.rows.length === 0) {
      return res.status(404).json({ error: "Circle not found" });
    }

    res.json(circleResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load circle" });
  }
});

export default router;
