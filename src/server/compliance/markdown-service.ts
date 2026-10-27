/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { catalogueProducts, markdownProducts, markdownSheetItems, markdownSheets, wastageItems, auditEvents } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { requireLocationManager } from "../auth/core.js";
import { ApiError } from "./errors.js";
import { idempotentOfflineMutation } from "./offline-idempotency.js";
import { activeMember, locationFor, now } from "./shared.js";
import { requireEnum, requireFiniteNumber, requireString, requireUuid } from "./validation.js";

const modes = ["use", "reduce"] as const;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

async function ensureSheet(tx: any, locationId: string, dateKey: string, userId: string) {
  const [existing] = await tx.select().from(markdownSheets).where(and(eq(markdownSheets.locationId, locationId), eq(markdownSheets.dateKey, dateKey))).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(markdownSheets).values({ locationId, dateKey, createdBy: userId }).onConflictDoNothing({ target: [markdownSheets.locationId, markdownSheets.dateKey] }).returning();
  if (created) return created;
  const [raced] = await tx.select().from(markdownSheets).where(and(eq(markdownSheets.locationId, locationId), eq(markdownSheets.dateKey, dateKey))).limit(1);
  if (!raced) throw new ApiError(409, "The Markdown Sheet could not be created safely. Please retry.");
  return raced;
}

async function listItems(db: any, locationId: string, dateKey: string) {
  const [sheet] = await db.select().from(markdownSheets).where(and(eq(markdownSheets.locationId, locationId), eq(markdownSheets.dateKey, dateKey))).limit(1);
  if (!sheet) return { sheet: null, items: [] };
  const items = await db.select({ item: markdownSheetItems, productName: markdownProducts.name }).from(markdownSheetItems).innerJoin(markdownProducts, eq(markdownProducts.id, markdownSheetItems.productId)).where(eq(markdownSheetItems.sheetId, sheet.id)).orderBy(asc(markdownProducts.order), asc(markdownProducts.name));
  return { sheet, items: items.map((row: any) => ({ ...row.item, productName: row.productName })) };
}

export async function listMarkdownSheet(context: AuthContext, locationId: string, dateKey: string) {
  const location = await locationFor(context, locationId);
  if (!dateKeyPattern.test(dateKey)) throw new ApiError(422, "dateKey must be YYYY-MM-DD");
  const db = getDb();
  const profiles = await db.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, location.id), eq(markdownProducts.active, true), isNull(markdownProducts.temporaryDateKey))).orderBy(asc(markdownProducts.order), asc(markdownProducts.name));
  const catalogue = await db.select({ id: catalogueProducts.id, name: catalogueProducts.name, plu: catalogueProducts.plu, department: catalogueProducts.department, group: catalogueProducts.group }).from(catalogueProducts).where(and(eq(catalogueProducts.locationId, location.id), eq(catalogueProducts.active, true))).orderBy(asc(catalogueProducts.name));
  const manual = await db.select().from(wastageItems).where(and(eq(wastageItems.locationId, location.id), eq(wastageItems.active, true)));
  const products = profiles.filter(product => product.quickSelect && (!product.wastageItemId || manual.some(item => item.id === product.wastageItemId)) && (!product.catalogueProductId || catalogue.some(item => item.id === product.catalogueProductId)));
  const reusable = profiles.filter(product => !product.catalogueProductId && !product.wastageItemId);
  const available = [...catalogue.map(product => ({ ...product, catalogueProductId: product.id, markdownProductId: profiles.find(profile => profile.catalogueProductId === product.id)?.id })), ...manual.map(product => ({ ...product, wastageItemId: product.id, markdownProductId: profiles.find(profile => profile.wastageItemId === product.id)?.id })), ...reusable];
  const current = await listItems(db, location.id, dateKey);
  const outstandingRows = await db.select({ item: markdownSheetItems, productName: markdownProducts.name, dateKey: markdownSheets.dateKey }).from(markdownSheetItems).innerJoin(markdownSheets, eq(markdownSheets.id, markdownSheetItems.sheetId)).innerJoin(markdownProducts, eq(markdownProducts.id, markdownSheetItems.productId)).where(and(eq(markdownSheets.locationId, location.id), lt(markdownSheets.dateKey, dateKey), gt(markdownSheetItems.quantity, 0), isNull(markdownSheetItems.completedAt), isNull(markdownSheetItems.reviewedAt))).orderBy(asc(markdownSheets.dateKey), asc(markdownProducts.name));
  const outstanding = outstandingRows.map(row => ({ ...row.item, productName: row.productName, dateKey: row.dateKey }));
  return { locationId: location.id, dateKey, products, favourites: products, catalogue: available, ...current, reminder: outstanding.length ? { dateKey: outstanding[0].dateKey, count: outstanding.reduce((total: number, item: any) => total + item.quantity, 0), items: outstanding } : null };
}

async function manualProfile(tx: any, locationId: string, rawId: unknown) {
  const itemId = requireUuid(rawId, "wastageItemId");
  const [item] = await tx.select().from(wastageItems).where(and(eq(wastageItems.id, itemId), eq(wastageItems.locationId, locationId), eq(wastageItems.active, true))).limit(1);
  if (!item) throw new ApiError(422, "Product is not available at this store");
  await tx.insert(markdownProducts).values({ locationId, wastageItemId: item.id, name: item.name, source: "manual", quickSelect: false }).onConflictDoNothing();
  const [profile] = await tx.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, locationId), eq(markdownProducts.wastageItemId, item.id))).limit(1);
  return profile;
}

async function resolveProduct(tx: any, locationId: string, dateKey: string, input: Record<string, unknown>) {
  if (input.wastageItemId) return manualProfile(tx, locationId, input.wastageItemId);
  if (typeof input.productId === "string" && input.productId) {
    const productId = requireUuid(input.productId, "productId");
    const [product] = await tx.select().from(markdownProducts).where(and(eq(markdownProducts.id, productId), eq(markdownProducts.locationId, locationId), eq(markdownProducts.active, true))).limit(1);
    if (!product) throw new ApiError(422, "Product is not available at this store");
    if (product.wastageItemId) await manualProfile(tx, locationId, product.wastageItemId);
    if (product.temporaryDateKey && product.temporaryDateKey !== dateKey) throw new ApiError(422, "One-off product belongs to a different day");
    return product;
  }
  if (typeof input.catalogueProductId === "string" && input.catalogueProductId) {
    const catalogueProductId = requireUuid(input.catalogueProductId, "catalogueProductId");
    const [catalogueProduct] = await tx.select().from(catalogueProducts).where(and(eq(catalogueProducts.id, catalogueProductId), eq(catalogueProducts.locationId, locationId), eq(catalogueProducts.active, true))).limit(1);
    if (!catalogueProduct) throw new ApiError(422, "Product is not available at this store");
    let [product] = await tx.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, locationId), eq(markdownProducts.catalogueProductId, catalogueProduct.id), isNull(markdownProducts.temporaryDateKey))).limit(1);
    if (!product) [product] = await tx.insert(markdownProducts).values({ locationId, catalogueProductId: catalogueProduct.id, name: catalogueProduct.name, source: "catalogue", order: 0 }).returning();
    return product;
  }
  const name = requireString(input.temporaryName, "Product name").slice(0, 120);
  let [product] = await tx.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, locationId), eq(markdownProducts.name, name), eq(markdownProducts.temporaryDateKey, dateKey), eq(markdownProducts.active, true))).limit(1);
  if (!product) [product] = await tx.insert(markdownProducts).values({ locationId, name, source: "temporary", temporaryDateKey: dateKey, order: 0 }).returning();
  return product;
}

export async function updateMarkdownSheet(context: AuthContext, input: Record<string, unknown>) {
  const locationId = requireUuid(input.locationId, "locationId");
  const location = await locationFor(context, locationId);
  const dateKey = requireString(input.dateKey, "dateKey");
  if (!dateKeyPattern.test(dateKey)) throw new ApiError(422, "dateKey must be YYYY-MM-DD");
  const action = requireEnum(input.action, "action", ["quantity", "complete", "review-reminder"] as const);
  const db = getDb();
  return db.transaction((tx: any) => idempotentOfflineMutation(tx, context, { key: typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined, organisationId: location.organisationId, locationId: location.id, operation: "markdown-sheet", payload: input }, async () => {
    // Serialize changes to one day's sheet, including simultaneous taps from different devices.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${location.id + ":" + dateKey}, 0))`);
    const member = await activeMember(location.id, requireUuid(input.teamMemberId, "teamMemberId"));
    const sheet = await ensureSheet(tx, location.id, dateKey, context.user.id);
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "markdown_sheet_action", detail: JSON.stringify({ action, dateKey, staffId: member.id, productId: input.productId, delta: input.delta, mode: input.mode, reminderItemId: input.reminderItemId }), createdAt: now() });
    if (action === "review-reminder") {
      const itemId = requireUuid(input.reminderItemId, "reminderItemId");
      const [previous] = await tx.select({ id: markdownSheets.id }).from(markdownSheets).innerJoin(markdownSheetItems, eq(markdownSheetItems.sheetId, markdownSheets.id)).where(and(eq(markdownSheets.locationId, location.id), lt(markdownSheets.dateKey, dateKey), eq(markdownSheetItems.id, itemId))).limit(1);
      if (!previous) throw new ApiError(404, "Previous sheet not found");
      const [reviewed] = await tx.update(markdownSheetItems).set({ reviewedAt: now(), reviewedBy: context.user.id }).where(and(eq(markdownSheetItems.id, itemId), eq(markdownSheetItems.sheetId, previous.id), eq(markdownSheetItems.locationId, location.id), isNull(markdownSheetItems.reviewedAt))).returning();
      if (!reviewed) throw new ApiError(409, "Item already reviewed or unavailable; refresh the sheet");
      return { itemId, reviewed: true, serverConfirmed: true };
    }
    const mode = requireEnum(input.mode, "mode", modes);
    const product = await resolveProduct(tx, location.id, dateKey, input);
    const [existing] = await tx.select().from(markdownSheetItems).where(and(eq(markdownSheetItems.sheetId, sheet.id), eq(markdownSheetItems.productId, product.id), eq(markdownSheetItems.mode, mode))).limit(1);
    if (action === "complete") {
      const memberId = await activeMember(location.id, requireUuid(input.teamMemberId, "teamMemberId")).then(member => member.id);
      if (!existing || existing.quantity < 1) throw new ApiError(422, "Add a quantity before completing this item");
      const completed = typeof input.completed === "boolean" ? input.completed : existing.completedAt === null;
      await tx.update(markdownSheetItems).set({ completedAt: completed ? now() : null, completedBy: completed ? context.user.id : null, completedTeamMemberId: completed ? memberId : null }).where(eq(markdownSheetItems.id, existing.id));
      return { itemId: existing.id, completed, serverConfirmed: true };
    }
    const delta = requireFiniteNumber(input.delta, "delta");
    if (delta !== 1 && delta !== -1) throw new ApiError(422, "Quantity changes must be one unit at a time");
    if (!existing) {
      if (delta < 0) return { quantity: 0, serverConfirmed: true };
      const [created] = await tx.insert(markdownSheetItems).values({ sheetId: sheet.id, locationId: location.id, productId: product.id, mode, quantity: 1 }).returning({ id: markdownSheetItems.id, quantity: markdownSheetItems.quantity });
      return { itemId: created.id, quantity: created.quantity, serverConfirmed: true };
    }
    const nextQuantity = Math.max(0, existing.quantity + delta);
    await tx.update(markdownSheetItems).set({ quantity: nextQuantity, ...(nextQuantity === 0 || delta > 0 ? { completedAt: null, completedBy: null, completedTeamMemberId: null } : {}) }).where(eq(markdownSheetItems.id, existing.id));
    return { itemId: existing.id, quantity: nextQuantity, serverConfirmed: true };
  }));
}

export async function addMarkdownProduct(context: AuthContext, input: { locationId: string; name: string }) {
  const location = await locationFor(context, input.locationId);
  requireLocationManager(context, location.id, location.organisationId);
  const name = requireString(input.name, "Product name").slice(0, 120);
  const [created] = await getDb().insert(markdownProducts).values({ locationId: location.id, name, source: "custom", quickSelect: false, order: 0 }).returning();
  return created;
}

async function managerLocation(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId);
  requireLocationManager(context, location.id, location.organisationId);
  return location;
}

export async function listMarkdownConfig(context: AuthContext, locationId: string) {
  const location = await managerLocation(context, locationId);
  const db = getDb();
  const [configured, catalogue] = await Promise.all([
    db.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, location.id), isNull(markdownProducts.temporaryDateKey))).orderBy(asc(markdownProducts.order), asc(markdownProducts.name)),
    db.select({ id: catalogueProducts.id, name: catalogueProducts.name, plu: catalogueProducts.plu, department: catalogueProducts.department, group: catalogueProducts.group }).from(catalogueProducts).where(and(eq(catalogueProducts.locationId, location.id), eq(catalogueProducts.active, true))).orderBy(asc(catalogueProducts.name)),
  ]);
  const manual = await db.select().from(wastageItems).where(and(eq(wastageItems.locationId, location.id), eq(wastageItems.active, true)));
  return { locationId: location.id, configured, catalogue: [...catalogue, ...manual.map(item => ({ ...item, wastageItemId: item.id }))] };
}

export async function updateMarkdownConfig(context: AuthContext, input: Record<string, unknown>) {
  const location = await managerLocation(context, requireUuid(input.locationId, "locationId"));
  const action = requireEnum(input.action, "action", ["add-catalogue", "add-manual", "add-custom", "update", "reorder"] as const);
  const db = getDb();
  if (action === "add-manual") return db.transaction(async tx => {
    const profile = await manualProfile(tx, location.id, input.wastageItemId);
    return tx.update(markdownProducts).set({ quickSelect: true, active: true }).where(eq(markdownProducts.id, profile.id)).returning();
  });
  if (action === "add-catalogue") {
    const catalogueProductId = requireUuid(input.catalogueProductId, "catalogueProductId");
    const [catalogueProduct] = await db.select().from(catalogueProducts).where(and(eq(catalogueProducts.id, catalogueProductId), eq(catalogueProducts.locationId, location.id), eq(catalogueProducts.active, true))).limit(1);
    if (!catalogueProduct) throw new ApiError(422, "Product is not available at this store");
    const [existing] = await db.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, location.id), eq(markdownProducts.catalogueProductId, catalogueProduct.id), isNull(markdownProducts.temporaryDateKey))).limit(1);
    if (existing) return db.update(markdownProducts).set({ name: catalogueProduct.name, active: true, quickSelect: true }).where(eq(markdownProducts.id, existing.id)).returning();
    const [created] = await db.insert(markdownProducts).values({ locationId: location.id, catalogueProductId: catalogueProduct.id, name: catalogueProduct.name, source: "catalogue", quickSelect: true, order: 0 }).returning();
    return created;
  }
  if (action === "add-custom") {
    const name = requireString(input.name, "Product name").slice(0, 120);
    const [created] = await db.insert(markdownProducts).values({ locationId: location.id, name, source: "custom", quickSelect: true, order: 0 }).returning();
    return created;
  }
  if (action === "reorder") {
    if (!Array.isArray(input.productIds)) throw new ApiError(422, "productIds must be an array");
    const productIds = input.productIds as unknown[];
    await db.transaction(async (tx: any) => {
      for (const [order, value] of productIds.entries()) await tx.update(markdownProducts).set({ order }).where(and(eq(markdownProducts.id, requireUuid(value, "productId")), eq(markdownProducts.locationId, location.id), isNull(markdownProducts.temporaryDateKey)));
    });
    return { saved: true };
  }
  const productId = requireUuid(input.productId, "productId");
  const [product] = await db.select().from(markdownProducts).where(and(eq(markdownProducts.id, productId), eq(markdownProducts.locationId, location.id), isNull(markdownProducts.temporaryDateKey))).limit(1);
  if (!product) throw new ApiError(404, "Markdown product not found");
  const values: Record<string, unknown> = {};
  if (typeof input.active === "boolean") values.active = input.active;
  if (typeof input.quickSelect === "boolean") values.quickSelect = input.quickSelect;
  if (typeof input.order === "number" && Number.isInteger(input.order)) values.order = input.order;
  if (!Object.keys(values).length) throw new ApiError(422, "No configuration changes supplied");
  const [updated] = await db.update(markdownProducts).set(values).where(eq(markdownProducts.id, product.id)).returning();
  return updated;
}

