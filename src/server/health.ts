import { sql } from "drizzle-orm";

export async function checkDatabase(db?: { execute: (query: unknown) => Promise<unknown> }) {
  const activeDb = db ?? (await import("./db/client.js")).getDb();
  await activeDb.execute(sql`select 1`);
  return { ok: true, database: "connected" as const };
}
