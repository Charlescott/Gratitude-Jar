import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
const host = process.env.PGHOST || process.env.DB_HOST || "";
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString || host);

const pool = new Pool({
  ...(connectionString ? { connectionString } : {}),
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export default pool;
