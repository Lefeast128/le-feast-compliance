import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { catalogueProducts, wastageItems, wastageRecords } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { assertCatalogueProductUsable, catalogueWastageSnapshot, parseWastageMode } from "../wastage/catalogue.js";
import { requirePositiveNumberString, requireUuid } from "./validation.js";

type InsertExecutor = Pick<ReturnType<typeof getDb>, "insert">;

export async function recordWastage(context: AuthContext, input: { locationId: string; itemId?: string; catalogueProductId?: string; adHocItemName?: string; quantity?: string; notes?: string; noWaste: boolean; teamMemberId: string }) {
  if (typeof input.noWaste !== "boolean") throw new ApiError(400, "noWaste must be boolean");
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  let mode: ReturnType<typeof parseWastageMode>;
  try {
    mode = parseWastageMode(input);
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Invalid wastage record");
  }
  const db = getDb();
  if (mode.source === "no_waste") return insertWastage(db, { locationId: location.id, notes: input.notes, noWaste: true, source: "no_waste", userId: context.user.id, teamMemberId: input.teamMemberId });
  const quantity = requirePositiveNumberString(input.quantity);

  if (mode.source === "legacy") {
    const itemId = requireUuid(mode.itemId, "itemId");
    const [item] = await db.select().from(wastageItems).where(and(eq(wastageItems.id, itemId), eq(wastageItems.locationId, location.id))).limit(1);
    if (!item) throw new ApiError(422, "Wastage item does not belong to this location");
    if (!item.active) throw new ApiError(422, "Wastage item is inactive");
    return insertWastage(db, { locationId: location.id, itemId: item.id, itemName: item.name, quantity, notes: input.notes, noWaste: false, source: "legacy", userId: context.user.id, teamMemberId: input.teamMemberId });
  }

  if (mode.source === "adhoc") return insertWastage(db, { locationId: location.id, itemName: mode.itemName, quantity, notes: input.notes, noWaste: false, source: "adhoc", userId: context.user.id, teamMemberId: input.teamMemberId });

  const catalogueProductId = requireUuid(mode.productId, "catalogueProductId");
  return db.transaction(async tx => {
    const [product] = await tx.select().from(catalogueProducts).where(eq(catalogueProducts.id, catalogueProductId)).limit(1);
    if (!product) throw new ApiError(422, "Catalogue product does not belong to this location");
    try {
      assertCatalogueProductUsable(product, location.id);
    } catch (error) {
      throw new ApiError(422, error instanceof Error ? error.message : "Catalogue product is not available for wastage");
    }
    return insertWastage(tx, { locationId: location.id, ...catalogueWastageSnapshot(product), quantity, notes: input.notes, noWaste: false, userId: context.user.id, teamMemberId: input.teamMemberId });
  });
}
async function insertWastage(db: InsertExecutor, input: { locationId: string; itemId?: string; catalogueProductId?: string; itemName?: string | null; cataloguePlu?: number | null; categorySnapshot?: string | null; quantity?: string; notes?: string; noWaste: boolean; source: "no_waste" | "legacy" | "catalogue" | "adhoc"; userId: string; teamMemberId: string }) {
  const [record] = await db.insert(wastageRecords).values({ locationId: input.locationId, itemId: input.itemId ?? null, catalogueProductId: input.catalogueProductId ?? null, itemName: input.itemName ?? null, cataloguePlu: input.cataloguePlu ?? null, categorySnapshot: input.categorySnapshot ?? null, wastageSource: input.source, quantity: input.quantity ?? null, notes: input.notes?.trim() || null, noWaste: input.noWaste, createdAt: now(), createdBy: input.userId, teamMemberId: input.teamMemberId }).returning({ id: wastageRecords.id });
  return { recordId: record.id };
}
