import { and, eq } from "drizzle-orm";
import { wastageItems } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id, locationFor, text } from "./shared.js";

async function wastageLocation(context: AuthContext, itemId: string) {
  const idValue = id(itemId, "itemId");
  const [row] = await db().select().from(wastageItems).where(eq(wastageItems.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Wastage item not found");
  await locationFor(context, row.locationId);
  return row;
}

export async function addWastage(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const name = text(input.name, "Name");
  const rows = await db().select().from(wastageItems).where(eq(wastageItems.locationId, location.id));
  if (rows.some(row => row.active && row.name.trim().toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A wastage item with this name already exists");
  const [row] = await db().insert(wastageItems).values({ locationId: location.id, name, order: rows.length, active: true }).returning();
  return row;
}

export async function updateWastage(context: AuthContext, itemId: string, input: Record<string, unknown>) {
  const old = await wastageLocation(context, itemId);
  if (!old.active) throw new ApiError(409, "Wastage item is inactive");
  const name = text(input.name, "Name");
  const rows = await db().select().from(wastageItems).where(eq(wastageItems.locationId, old.locationId));
  if (rows.some(row => row.id !== old.id && row.active && row.name.trim().toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A wastage item with this name already exists");
  const [row] = await db().update(wastageItems).set({ name }).where(eq(wastageItems.id, old.id)).returning();
  return row;
}

export async function deleteWastage(context: AuthContext, itemId: string) {
  const old = await wastageLocation(context, itemId);
  if (!old.active) throw new ApiError(409, "Wastage item is inactive");
  await db().update(wastageItems).set({ active: false }).where(eq(wastageItems.id, old.id));
  return { id: old.id, active: false };
}

export async function reorderWastage(context: AuthContext, itemId: string, direction: unknown) {
  const old = await wastageLocation(context, itemId);
  requireEnum(direction, "direction", ["up", "down"] as const);
  const rows = (await db().select().from(wastageItems).where(and(eq(wastageItems.locationId, old.locationId), eq(wastageItems.active, true)))).sort((a, b) => a.order - b.order);
  const i = rows.findIndex(row => row.id === old.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || !rows[j]) return old;
  return db().transaction(async tx => {
    await tx.update(wastageItems).set({ order: rows[j].order }).where(eq(wastageItems.id, rows[i].id));
    await tx.update(wastageItems).set({ order: rows[i].order }).where(eq(wastageItems.id, rows[j].id));
    return rows[i];
  });
}
