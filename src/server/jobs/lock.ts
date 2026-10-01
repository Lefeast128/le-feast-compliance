import { getPool } from "../db/client.js";
export { cronAuthorized } from "./auth.js";
export async function withJobLock<T>(key: string, work: () => Promise<T>) {
  const client = await getPool().connect();
  const lockKey = `le-feast:${key}`;
  try {
    const result = await client.query("select pg_try_advisory_lock(hashtext($1)) as locked", [lockKey]);
    if (!result.rows[0]?.locked) return { skipped: true as const };
    try {
      return { skipped: false as const, value: await work() };
    } finally {
      await client.query("select pg_advisory_unlock(hashtext($1))", [lockKey]);
    }
  } finally {
    client.release();
  }
}
