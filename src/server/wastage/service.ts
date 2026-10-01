/* eslint-disable @typescript-eslint/no-explicit-any */
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { locations, wastageRecords } from "../db/schema.js";
import { withJobLock } from "../jobs/lock.js";
import { buildWastageExportRows } from "./pure.js";
import { syncWastageRows } from "./google.js";

export async function exportAllWastageRows() {
  const db = getDb();
  const allLocations = await db.select().from(locations).where(eq(locations.active, true));
  const rows: any[] = [];
  for (const location of allLocations) {
    const records = await db.select({ itemName: wastageRecords.itemName, quantity: wastageRecords.quantity, noWaste: wastageRecords.noWaste, createdAt: wastageRecords.createdAt }).from(wastageRecords).where(eq(wastageRecords.locationId, location.id));
    rows.push(...buildWastageExportRows(records, location));
  }
  const byKey = new Set<string>();
  for (const row of rows) { const key = `${row.Store}\0${row.Date}\0${row["Food Type"]}`; if (byKey.has(key)) throw new Error(`Duplicate wastage export row: ${key}`); byKey.add(key); }
  return rows.sort((a, b) => a.Store.localeCompare(b.Store) || a.Date.localeCompare(b.Date) || a["Food Type"].localeCompare(b["Food Type"]));
}

export async function scheduledWastageSync() {
  const startedAt = Date.now();
  const lock = await withJobLock("wastage-google-sheets", async () => { const rows = await exportAllWastageRows(); return { rows, result: await syncWastageRows(rows) }; });
  if (lock.skipped) return { ok: true, skipped: true, reason: "already_running" };
  const output = { ok: true, rowCount: lock.value.rows.length, ...lock.value.result };
  console.info("wastage-sync", { job: "wastage-google-sheets", startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, ...output });
  return output;
}
