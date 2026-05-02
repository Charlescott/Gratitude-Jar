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

      // Pending follow requests
      await pool.query(`
        CREATE TABLE IF NOT EXISTS follow_requests (
          id SERIAL PRIMARY KEY,
          requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          requestee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'accepted', 'denied')),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          CHECK (requester_id <> requestee_id)
        )
      `);
      // Only one pending request per (requester, requestee). Old denied/accepted rows
      // don't block re-requesting because the partial index ignores them.
      await pool.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS follow_requests_pending_unique
         ON follow_requests (requester_id, requestee_id)
         WHERE status = 'pending'`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS follow_requests_requestee_idx
         ON follow_requests (requestee_id, status)`
      );

      // User blocks (symmetric — application-level filters use both directions)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_blocks (
          blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (blocker_id, blocked_id),
          CHECK (blocker_id <> blocked_id)
        )
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx
         ON user_blocks (blocked_id)`
      );
    })();
  }

  await socialSchemaReadyPromise;
}
