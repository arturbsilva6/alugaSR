import pg from "pg";

export function createDatabase(connectionString) {
  if (!connectionString) return null;
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 2500,
    idleTimeoutMillis: 10000
  });
  return {
    async ping() {
      const { rows } = await pool.query("SELECT 1::int AS status");
      return rows[0]?.status === 1;
    },
    async close() {
      await pool.end();
    }
  };
}
