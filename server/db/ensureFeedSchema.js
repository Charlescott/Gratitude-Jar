import { INSPIRATION_QUOTES } from "./inspirationQuotes.js";

let feedSchemaReadyPromise = null;

export default async function ensureFeedSchema(pool) {
  if (!feedSchemaReadyPromise) {
    feedSchemaReadyPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS inspiration_quotes (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL UNIQUE,
          author TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS news_stories (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          summary TEXT,
          url TEXT NOT NULL UNIQUE,
          image_url TEXT,
          source TEXT,
          published_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          hidden BOOLEAN DEFAULT FALSE
        )
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS news_stories_published_idx
         ON news_stories (published_at DESC)`
      );

      await pool.query(`
        CREATE TABLE IF NOT EXISTS entry_reactions (
          id SERIAL PRIMARY KEY,
          entry_id INTEGER NOT NULL REFERENCES gratitude_entries(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          emoji TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE (entry_id, user_id)
        )
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS entry_reactions_entry_idx
         ON entry_reactions (entry_id)`
      );

      const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS c FROM inspiration_quotes"
      );
      if (rows[0].c > 0 || !INSPIRATION_QUOTES.length) return;

      const params = [];
      const placeholders = [];
      INSPIRATION_QUOTES.forEach((q, i) => {
        placeholders.push(`($${i * 2 + 1}, $${i * 2 + 2})`);
        params.push(q.text, q.author || null);
      });

      await pool.query(
        `INSERT INTO inspiration_quotes (text, author)
         VALUES ${placeholders.join(", ")}
         ON CONFLICT (text) DO NOTHING`,
        params
      );
    })();
  }

  await feedSchemaReadyPromise;
}
