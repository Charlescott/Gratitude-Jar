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
