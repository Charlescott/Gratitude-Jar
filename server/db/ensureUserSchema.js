let userSchemaReadyPromise = null;

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export default async function ensureUserSchema(pool, { adminEmail } = {}) {
  if (!userSchemaReadyPromise) {
    userSchemaReadyPromise = (async () => {
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT TRUE`
      );
      await pool.query(
        `UPDATE users
         SET email_verified = TRUE
         WHERE email_verified IS NULL`
      );
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS password_reset_jti TEXT`
      );
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ`
      );

      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE`
      );
      await pool.query(
        `UPDATE users
         SET is_admin = FALSE
         WHERE is_admin IS NULL`
      );
      await pool.query(
        `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ`
      );

      const emailToPromote = normalizeEmail(adminEmail);
      if (emailToPromote) {
        await pool.query(
          `UPDATE users
           SET is_admin = TRUE
           WHERE LOWER(email) = LOWER($1)`,
          [emailToPromote]
        );
      }
    })();
  }

  await userSchemaReadyPromise;
}

