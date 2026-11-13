import { and, asc, eq } from "drizzle-orm";
import { audit, db, id, locationFor, text } from "./shared.js";
import { catalogueProducts, wastageCategories, wastageItems } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";

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
  const category = input.category === undefined || input.category === null || input.category === "" ? null : text(input.category, "category");
  const [row] = await db().insert(wastageItems).values({ locationId: location.id, name, category, order: rows.length, active: true }).returning();
  return row;
}

export async function updateWastage(context: AuthContext, itemId: string, input: Record<string, unknown>) {
  const old = await wastageLocation(context, itemId);
  if (!old.active) throw new ApiError(409, "Wastage item is inactive");
  const name = text(input.name, "Name");
  const category = input.category === undefined ? old.category : input.category === null || input.category === "" ? null : text(input.category, "category");
  const rows = await db().select().from(wastageItems).where(eq(wastageItems.locationId, old.locationId));
  if (rows.some(row => row.id !== old.id && row.active && row.name.trim().toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A wastage item with this name already exists");
  const [row] = await db().update(wastageItems).set({ name, category }).where(eq(wastageItems.id, old.id)).returning();
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

export async function listWastageManagement(context: AuthContext, locationId: string) {
  const location = await locationFor(context, id(locationId, "locationId"));
  const [manual, categories, catalogue] = await Promise.all([
    db().select().from(wastageItems).where(eq(wastageItems.locationId, location.id)).orderBy(asc(wastageItems.order)),
    db().select().from(wastageCategories).where(eq(wastageCategories.locationId, location.id)).orderBy(asc(wastageCategories.order), asc(wastageCategories.name)),
    db().select({ id: catalogueProducts.id, name: catalogueProducts.name, plu: catalogueProducts.plu, category: catalogueProducts.wastageCategory, active: catalogueProducts.active, excluded: catalogueProducts.excludedFromWastage }).from(catalogueProducts).where(eq(catalogueProducts.locationId, location.id)).orderBy(asc(catalogueProducts.name)),
  ]);
  return { locationId: location.id, manualProducts: manual, categories, catalogueProducts: catalogue };
}

export async function addWastageCategory(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const name = text(input.name, "Name").trim();
  const rows = await db().select().from(wastageCategories).where(eq(wastageCategories.locationId, location.id));
  if (rows.some(row => row.active && row.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) throw new ApiError(409, "A wastage category with this name already exists");
  const [row] = await db().insert(wastageCategories).values({ locationId: location.id, name, order: rows.length, active: true }).returning();
  return row;
}

async function categoryFor(context: AuthContext, categoryId: string) {
  const [row] = await db().select().from(wastageCategories).where(eq(wastageCategories.id, id(categoryId, "categoryId"))).limit(1);
  if (!row) throw new ApiError(404, "Wastage category not found");
  await locationFor(context, row.locationId);
  return row;
}

export async function updateWastageCategory(context: AuthContext, categoryId: string, input: Record<string, unknown>) {
  const old = await categoryFor(context, categoryId);
  const name = text(input.name, "Name").trim();
  const rows = await db().select().from(wastageCategories).where(eq(wastageCategories.locationId, old.locationId));
  if (rows.some(row => row.id !== old.id && row.active && row.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) throw new ApiError(409, "A wastage category with this name already exists");
  return db().transaction(async tx => {
    await tx.update(wastageCategories).set({ name }).where(eq(wastageCategories.id, old.id));
    await tx.update(wastageItems).set({ category: name }).where(and(eq(wastageItems.locationId, old.locationId), eq(wastageItems.category, old.name)));
    await tx.update(catalogueProducts).set({ wastageCategory: name }).where(and(eq(catalogueProducts.locationId, old.locationId), eq(catalogueProducts.wastageCategory, old.name)));
    await audit(tx, old.locationId, context.user.id, "wastage_category_renamed", `Renamed wastage category ${old.name} to ${name}`);
    const [row] = await tx.select().from(wastageCategories).where(eq(wastageCategories.id, old.id));
    return row;
  });
}

export async function deleteWastageCategory(context: AuthContext, categoryId: string) {
  const old = await categoryFor(context, categoryId);
  if (!old.active) throw new ApiError(409, "Wastage category is already archived");
  await db().update(wastageCategories).set({ active: false }).where(eq(wastageCategories.id, old.id));
  return { id: old.id, active: false };
}

export async function reorderWastageCategory(context: AuthContext, categoryId: string, direction: unknown) {
  const old = await categoryFor(context, categoryId);
  requireEnum(direction, "direction", ["up", "down"] as const);
  const rows = (await db().select().from(wastageCategories).where(and(eq(wastageCategories.locationId, old.locationId), eq(wastageCategories.active, true)))).sort((a, b) => a.order - b.order);
  const i = rows.findIndex(row => row.id === old.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || !rows[j]) return old;
  return db().transaction(async tx => {
    await tx.update(wastageCategories).set({ order: rows[j].order }).where(eq(wastageCategories.id, rows[i].id));
    await tx.update(wastageCategories).set({ order: rows[i].order }).where(eq(wastageCategories.id, rows[j].id));
    return rows[i];
  });
}
