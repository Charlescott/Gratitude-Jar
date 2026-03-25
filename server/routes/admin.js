import express from "express";
import pool from "../db/index.js";
import requireAdmin from "../middleware/requireAdmin.js";
import ensureUserSchema from "../db/ensureUserSchema.js";

const router = express.Router();

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || "scottfairdosi@yahoo.com";
}

async function ensureSchema() {
  await ensureUserSchema(pool, { adminEmail: getAdminEmail() });
}

router.get("/overview", requireAdmin, async (req, res) => {
  try {
    await ensureSchema();

    const [
      totalUsers,
      totalCircles,
      totalEntries,
      signedUpToday,
      signedInToday,
      entriesToday,
      circlesToday,
      dailySeries,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM circles"),
      pool.query("SELECT COUNT(*)::int AS count FROM gratitude_entries"),
      pool.query(
        `WITH bounds AS (
           SELECT date_trunc('day', (NOW() AT TIME ZONE 'UTC')) AS day_start_utc
         )
         SELECT COUNT(*)::int AS count
         FROM users, bounds
         WHERE created_at >= (bounds.day_start_utc AT TIME ZONE 'UTC')`
      ),
      pool.query(
        `WITH bounds AS (
           SELECT date_trunc('day', (NOW() AT TIME ZONE 'UTC')) AS day_start_utc
         )
         SELECT COUNT(*)::int AS count
         FROM users, bounds
         WHERE last_login_at IS NOT NULL
           AND last_login_at >= (bounds.day_start_utc AT TIME ZONE 'UTC')`
      ),
      pool.query(
        `WITH bounds AS (
           SELECT date_trunc('day', (NOW() AT TIME ZONE 'UTC')) AS day_start_utc
         )
         SELECT COUNT(*)::int AS count
         FROM gratitude_entries, bounds
         WHERE created_at >= (bounds.day_start_utc AT TIME ZONE 'UTC')`
      ),
      pool.query(
        `WITH bounds AS (
           SELECT date_trunc('day', (NOW() AT TIME ZONE 'UTC')) AS day_start_utc
         )
         SELECT COUNT(*)::int AS count
         FROM circles, bounds
         WHERE created_at >= (bounds.day_start_utc AT TIME ZONE 'UTC')`
      ),
      pool.query(
        `WITH days AS (
           SELECT generate_series(
             date_trunc('day', (NOW() AT TIME ZONE 'UTC')) - INTERVAL '13 days',
             date_trunc('day', (NOW() AT TIME ZONE 'UTC')),
             INTERVAL '1 day'
           ) AS day_start
         ),
         signups AS (
           SELECT date_trunc('day', (created_at AT TIME ZONE 'UTC')) AS day_start,
                  COUNT(*)::int AS count
           FROM users
           GROUP BY 1
         ),
         logins AS (
           SELECT date_trunc('day', (last_login_at AT TIME ZONE 'UTC')) AS day_start,
                  COUNT(*)::int AS count
           FROM users
           WHERE last_login_at IS NOT NULL
           GROUP BY 1
         ),
         entries AS (
           SELECT date_trunc('day', (created_at AT TIME ZONE 'UTC')) AS day_start,
                  COUNT(*)::int AS count
           FROM gratitude_entries
           GROUP BY 1
         )
         SELECT to_char(days.day_start, 'YYYY-MM-DD') AS day,
                COALESCE(signups.count, 0)::int AS signups,
                COALESCE(logins.count, 0)::int AS logins,
                COALESCE(entries.count, 0)::int AS entries
         FROM days
         LEFT JOIN signups ON signups.day_start = days.day_start
         LEFT JOIN logins ON logins.day_start = days.day_start
         LEFT JOIN entries ON entries.day_start = days.day_start
         ORDER BY days.day_start ASC`
      ),
    ]);

    return res.json({
      totals: {
        users: totalUsers.rows[0].count,
        circles: totalCircles.rows[0].count,
        entries: totalEntries.rows[0].count,
      },
      today: {
        users_signed_up: signedUpToday.rows[0].count,
        users_signed_in: signedInToday.rows[0].count,
        entries: entriesToday.rows[0].count,
        circles: circlesToday.rows[0].count,
      },
      daily: dailySeries.rows,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return res.status(500).json({ error: "Failed to load admin overview" });
  }
});

router.get("/users", requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "200", 10), 1), 500);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const orderByRaw = String(req.query.orderBy || "created_at");
    const directionRaw = String(req.query.direction || "desc").toLowerCase();
    const orderBy =
      orderByRaw === "last_login_at" ? "last_login_at" : "created_at";
    const direction = directionRaw === "asc" ? "ASC" : "DESC";

    const orderSql =
      orderBy === "last_login_at"
        ? `ORDER BY last_login_at ${direction} NULLS LAST, created_at DESC`
        : `ORDER BY created_at ${direction}`;

    const { rows } = await pool.query(
      `SELECT id, email, name, created_at, last_login_at
       FROM users
       ${orderSql}
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return res.json({ limit, offset, orderBy, direction: direction.toLowerCase(), users: rows });
  } catch (err) {
    console.error("Admin users error:", err);
    return res.status(500).json({ error: "Failed to load users" });
  }
});

router.get("/circles", requireAdmin, async (req, res) => {
  try {
    await ensureSchema();
    const limit = Math.min(Math.max(parseInt(req.query.limit || "100", 10), 1), 200);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.key,
         c.created_at,
         jsonb_build_object(
           'id', owner.id,
           'email', owner.email,
           'name', owner.name
         ) AS owner,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id', u.id,
               'email', u.email,
               'name', u.name,
               'joined_at', cm.joined_at
             )
             ORDER BY cm.joined_at ASC
           ) FILTER (WHERE u.id IS NOT NULL),
           '[]'::jsonb
         ) AS members
       FROM circles c
       LEFT JOIN users owner ON owner.id = c.owner_id
       LEFT JOIN circle_memberships cm ON cm.circle_id = c.id
       LEFT JOIN users u ON u.id = cm.user_id
       GROUP BY c.id, owner.id
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const circles = rows.map((row) => ({
      id: row.id,
      name: row.name,
      key: row.key,
      created_at: row.created_at,
      owner: row.owner,
      members: row.members,
      member_count: Array.isArray(row.members) ? row.members.length : 0,
    }));

    return res.json({ limit, offset, circles });
  } catch (err) {
    console.error("Admin circles error:", err);
    return res.status(500).json({ error: "Failed to load circles" });
  }
});

export default router;
