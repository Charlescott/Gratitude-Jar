import pool from "../db/index.js";
import requireUser from "./requireUser.js";
import ensureUserSchema from "../db/ensureUserSchema.js";

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export default function requireAdmin(req, res, next) {
  return requireUser(req, res, async () => {
    try {
      const adminEmail = normalizeEmail(
        process.env.ADMIN_EMAIL || "scottfairdosi@yahoo.com"
      );

      await ensureUserSchema(pool, { adminEmail });

      const { rows } = await pool.query(
        "SELECT email, is_admin FROM users WHERE id = $1",
        [req.user.id]
      );

      const user = rows[0];
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!user.is_admin || normalizeEmail(user.email) !== adminEmail) {
        return res.status(403).json({ error: "Admin access required" });
      }

      return next();
    } catch (err) {
      console.error("requireAdmin error:", err);
      return res.status(500).json({ error: "Failed to authorize admin" });
    }
  });
}

