let socialSchemaReadyPromise = null;

export default async function ensureSocialSchema(pool) {
  if (!socialSchemaReadyPromise) {
    socialSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS follows (
          id SERIAL PRIMARY KEY,
          follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          followee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (follower_id, followee_id),
          CHECK (follower_id <> followee_id)
        )
      `);

      await pool.query(
        `CREATE INDEX IF NOT EXISTS follows_followee_idx ON follows (followee_id)`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS follows_follower_idx ON follows (follower_id)`
      );

      await pool.query(
        `ALTER TABLE gratitude_entries
         ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'`
      );

      await pool.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'gratitude_entries_visibility_check'
          ) THEN
            ALTER TABLE gratitude_entries
              ADD CONSTRAINT gratitude_entries_visibility_check
              CHECK (visibility IN ('private', 'friends', 'public'));
          END IF;
        END
        $$;
      `);

      await pool.query(
        `CREATE INDEX IF NOT EXISTS gratitude_entries_visibility_created_idx
         ON gratitude_entries (visibility, created_at DESC)`
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS friend_digest_runs (
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          last_sent TIMESTAMPTZ
        )
      `);
    })();
  }

  await socialSchemaReadyPromise;
}
