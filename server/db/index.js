import pg from "pg";
import net from "node:net";

// Node 18.13+/20 enabled Happy Eyeballs (autoSelectFamily) by default. When a
// DB host resolves to multiple IPs (e.g. Render's external hostname), a bad IP
// can hang until ETIMEDOUT instead of failing over cleanly. Disable it so we
// connect deterministically.
net.setDefaultAutoSelectFamily(false);

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const host = process.env.PGHOST || process.env.DB_HOST || "";
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || host);

const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  ssl: isLocal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // fail fast with a clear error instead of hanging
});

export default pool;
