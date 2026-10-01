import { sql } from "drizzle-orm";
import { getDb } from "./db/client.ts";

export async function checkDatabase(db = getDb()) {
  await db.execute(sql`select 1`);
  return { ok: true, database: "connected" as const };
}
