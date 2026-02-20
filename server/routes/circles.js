import express from "express";
import pool from "../db/index.js";
import requireUser from "../middleware/requireUser.js";
import {
  sendCircleEntryNotificationEmail,
  sendCircleJoinNotificationEmail,
} from "./mailer.js";

const router = express.Router();

function generateKey() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function notifyCircleMembers(rows, senderFn, contextLabel) {
  const results = await Promise.allSettled(
    rows.map((member) => senderFn(member))
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(`${contextLabel} email failed:`, result.reason);
    }
  }
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
      SELECT c.*,
             (c.owner_id = $1) AS is_owner
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

    const joinResult = await pool.query(
      `INSERT INTO circle_memberships (circle_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING
       RETURNING user_id`,
      [circle.id, req.user.id],
    );

    if (joinResult.rows.length > 0) {
      const [joinerResult, memberRecipientsResult] = await Promise.all([
        pool.query("SELECT name FROM users WHERE id = $1", [req.user.id]),
        pool.query(
          `
          SELECT u.email, u.name
          FROM circle_memberships cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.circle_id = $1
            AND cm.user_id <> $2
            AND u.email IS NOT NULL
          `,
          [circle.id, req.user.id]
        ),
      ]);

      const joinerName = joinerResult.rows[0]?.name || "A new member";

      notifyCircleMembers(
        memberRecipientsResult.rows,
        ({ email, name }) =>
          sendCircleJoinNotificationEmail(email, {
            recipientName: name,
            circleName: circle.name,
            circleId: circle.id,
            joinerName,
          }),
        "Circle join notification"
      ).catch((err) => console.error("Circle join notification error:", err));
    }

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
      SELECT c.id, c.name, c.owner_id, c.key,
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

    const circle = circleResult.rows[0];
    const isOwner = circle.owner_id === req.user.id;

    res.json({
      ...circle,
      is_owner: isOwner,
      invite_key: isOwner ? circle.key : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load circle" });
  }
});

router.get("/:id/members", requireUser, async (req, res) => {
  const { id } = req.params;

  try {
    const membership = await pool.query(
      `
      SELECT 1 FROM circle_memberships
      WHERE circle_id = $1 AND user_id = $2
      `,
      [id, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this circle" });
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        (c.owner_id = u.id) AS is_owner
      FROM circle_memberships cm
      JOIN users u ON u.id = cm.user_id
      JOIN circles c ON c.id = cm.circle_id
      WHERE cm.circle_id = $1
      ORDER BY (c.owner_id = u.id) DESC, u.name ASC
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch circle members" });
  }
});

// Leave a circle (non-owner only)
router.delete("/:id/leave", requireUser, async (req, res) => {
  const { id } = req.params;

  try {
    const circleResult = await pool.query(
      "SELECT owner_id FROM circles WHERE id = $1",
      [id],
    );

    if (circleResult.rows.length === 0) {
      return res.status(404).json({ error: "Circle not found" });
    }

    if (circleResult.rows[0].owner_id === req.user.id) {
      return res.status(403).json({ error: "Owners must delete the circle" });
    }

    const result = await pool.query(
      `DELETE FROM circle_memberships
       WHERE circle_id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this circle" });
    }

    res.json({ message: "Left circle" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to leave circle" });
  }
});

// Delete a circle (owner only)
router.delete("/:id", requireUser, async (req, res) => {
  const { id } = req.params;

  try {
    const circleResult = await pool.query(
      "SELECT owner_id FROM circles WHERE id = $1",
      [id],
    );

    if (circleResult.rows.length === 0) {
      return res.status(404).json({ error: "Circle not found" });
    }

    if (circleResult.rows[0].owner_id !== req.user.id) {
      return res.status(403).json({ error: "Only the owner can delete" });
    }

    await pool.query("DELETE FROM circles WHERE id = $1", [id]);
    res.json({ message: "Circle deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete circle" });
  }
});
//Create shared gratitude entry in circle
router.post("/:id/entries", requireUser, async (req, res) => {
  const { id } = req.params;
  const { content, mood, is_anonymous } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: "Entry content required" });
  }

  try {
    // Check membership
    const membership = await pool.query(
      `
      SELECT 1 FROM circle_memberships
      WHERE circle_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this circle" });
    }

    let entry;
    try {
      const result = await pool.query(
        `
        INSERT INTO gratitude_entries (user_id, content, mood, circle_id, is_anonymous)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [req.user.id, content.trim(), mood || null, id, Boolean(is_anonymous)]
      );
      entry = result.rows[0];
    } catch (insertErr) {
      // Local DBs that haven't added is_anonymous yet should still be able to post.
      if (insertErr?.code !== "42703") throw insertErr;

      const fallbackResult = await pool.query(
        `
        INSERT INTO gratitude_entries (user_id, content, mood, circle_id)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [req.user.id, content.trim(), mood || null, id]
      );
      entry = { ...fallbackResult.rows[0], is_anonymous: false };
    }

    const [authorResult, circleResult, memberRecipientsResult] =
      await Promise.all([
        pool.query("SELECT name FROM users WHERE id = $1", [req.user.id]),
        pool.query("SELECT name FROM circles WHERE id = $1", [id]),
        pool.query(
          `
          SELECT u.email, u.name
          FROM circle_memberships cm
          JOIN users u ON u.id = cm.user_id
          WHERE cm.circle_id = $1
            AND cm.user_id <> $2
            AND u.email IS NOT NULL
          `,
          [id, req.user.id]
        ),
      ]);

    const authorName = authorResult.rows[0]?.name || "A member";
    const circleName = circleResult.rows[0]?.name || "your circle";

    res.status(201).json(entry);

    notifyCircleMembers(
      memberRecipientsResult.rows,
      ({ email, name }) =>
        sendCircleEntryNotificationEmail(email, {
          recipientName: name,
          circleName,
          circleId: id,
          actorName: authorName,
          isAnonymous: entry.is_anonymous,
        }),
      "Circle entry notification"
    ).catch((err) => console.error("Circle entry notification error:", err));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create entry" });
  }
});

router.get("/:id/entries", requireUser, async (req, res) => {
  const { id } = req.params;

  try {
    const membership = await pool.query(
      `
      SELECT 1 FROM circle_memberships
      WHERE circle_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this circle" });
    }

    let result;
    try {
      result = await pool.query(
        ` 
        SELECT
          g.*,
          CASE WHEN g.is_anonymous THEN 'Anonymous' ELSE u.name END AS name,
          (g.user_id = $2) AS is_mine
        FROM gratitude_entries g
        JOIN users u ON g.user_id = u.id
        WHERE g.circle_id = $1
        ORDER BY g.created_at DESC
        `,
        [id, req.user.id]
      );
    } catch (queryErr) {
      // Local DBs without is_anonymous should still return entries.
      if (queryErr?.code !== "42703") throw queryErr;
      result = await pool.query(
        ` 
        SELECT
          g.*,
          u.name,
          FALSE AS is_anonymous,
          (g.user_id = $2) AS is_mine
        FROM gratitude_entries g
        JOIN users u ON g.user_id = u.id
        WHERE g.circle_id = $1
        ORDER BY g.created_at DESC
        `,
        [id, req.user.id]
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch entries" });
  }
});

router.delete("/:id/entries/:entryId", requireUser, async (req, res) => {
  const { id, entryId } = req.params;

  try {
    const membership = await pool.query(
      `
      SELECT 1 FROM circle_memberships
      WHERE circle_id = $1 AND user_id = $2`,
      [id, req.user.id],
    );

    if (membership.rows.length === 0) {
      return res.status(403).json({ error: "Not a member of this circle" });
    }

    const result = await pool.query(
      `
      DELETE FROM gratitude_entries
      WHERE id = $1 AND circle_id = $2 AND user_id = $3
      RETURNING id
      `,
      [entryId, id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You can only delete your own entries" });
    }

    res.json({ message: "Entry deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete entry" });
  }
});

export default router;
