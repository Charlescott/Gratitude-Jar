import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM gratitude_entries ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

router.get("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM gratitude_entries WHERE id = $1 AND user_id = $2",
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Entry not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to fetch entry" });
  }
});

router.post("/", async (req, res) => {
  const { user_id, content, mood_tag } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO gratitude_entries (user_id, content, mood_tag) VALUES ($1, $2, $3) RETURNING *",
      [req.user_id, content, mood_tag]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to create entry" });
  }
  console.log(req.body);
});

router.put("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  const { content, mood_tag } = req.body;
  try {
    const result = await pool.query(
      "UPDATE gratitude_entries SET content = $1, mood_tag = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4 RETURNING *",
      [content, mood_tag, id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Entry not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to update entry" });
  }
});

router.delete("/:id", requireUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM gratitude_entries WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, req.user.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Entry not found" });
    res.json({ message: "Entry deleted", entry: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
