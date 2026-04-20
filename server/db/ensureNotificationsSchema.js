let notificationsSchemaReadyPromise = null;

export default async function ensureNotificationsSchema(pool) {
  if (!notificationsSchemaReadyPromise) {
    notificationsSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT,
          link TEXT,
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(
        `CREATE INDEX IF NOT EXISTS notifications_user_created_idx
         ON notifications (user_id, created_at DESC, id DESC)`
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
         ON notifications (user_id, created_at DESC)
         WHERE read_at IS NULL`
      );
    })();
  }

  await notificationsSchemaReadyPromise;
}
