/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { catalogueProducts, markdownProducts, markdownSheetItems, markdownSheets } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { requireLocationManager } from "../auth/core.js";
import { ApiError } from "./errors.js";
import { idempotentOfflineMutation } from "./offline-idempotency.js";
import { activeMember, locationFor, now } from "./shared.js";
import { requireEnum, requireFiniteNumber, requireString, requireUuid } from "./validation.js";

const modes = ["use", "reduce"] as const;
const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;
const previousDateKey = (dateKey: string) => { const date = new Date(`${dateKey}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };

async function ensureSheet(tx: any, locationId: string, dateKey: string, userId: string) {
  const [existing] = await tx.select().from(markdownSheets).where(and(eq(markdownSheets.locationId, locationId), eq(markdownSheets.dateKey, dateKey))).limit(1);
  if (existing) return existing;
  const [created] = await tx.insert(markdownSheets).values({ locationId, dateKey, createdBy: userId }).onConflictDoNothing({ target: [markdownSheets.locationId, markdownSheets.dateKey] }).returning();
  if (created) return created;
  const [raced] = await tx.select().from(markdownSheets).where(and(eq(markdownSheets.locationId, locationId), eq(markdownSheets.dateKey, dateKey))).limit(1);
  if (!raced) throw new ApiError(409, "The Markdown Sheet could not be created safely. Please retry.");
  return raced;
}

async function syncCatalogueProducts(tx: any, locationId: string) {
  const [configured, catalogue] = await Promise.all([
    tx.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, locationId), eq(markdownProducts.active, true))).orderBy(asc(markdownProducts.order), asc(markdownProducts.name)),
    tx.select({ name: catalogueProducts.name }).from(catalogueProducts).where(and(eq(catalogueProducts.locationId, locationId), eq(catalogueProducts.active, true))).orderBy(asc(catalogueProducts.plu)),
  ]);
  const names = new Set(configured.map((product: any) => product.name.toLocaleLowerCase()));
  for (const product of catalogue) if (!names.has(product.name.toLocaleLowerCase())) { await tx.insert(markdownProducts).values({ locationId, name: product.name, order: configured.length }); names.add(product.name.toLocaleLowerCase()); }
  return tx.select().from(markdownProducts).where(and(eq(markdownProducts.locationId, locationId), eq(markdownProducts.active, true))).orderBy(asc(markdownProducts.order), asc(markdownProducts.name));
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
  const products = await syncCatalogueProducts(db, location.id);
  const current = await listItems(db, location.id, dateKey);
  const previous = await listItems(db, location.id, previousDateKey(dateKey));
  const outstanding = previous.items.filter((item: any) => item.quantity > 0 && !item.completedAt && !item.reviewedAt);
  return { locationId: location.id, dateKey, products, ...current, reminder: outstanding.length ? { dateKey: previousDateKey(dateKey), count: outstanding.reduce((total: number, item: any) => total + item.quantity, 0), items: outstanding } : null };
}

export async function updateMarkdownSheet(context: AuthContext, input: Record<string, unknown>) {
  const locationId = requireUuid(input.locationId, "locationId");
  const location = await locationFor(context, locationId);
  const dateKey = requireString(input.dateKey, "dateKey");
  if (!dateKeyPattern.test(dateKey)) throw new ApiError(422, "dateKey must be YYYY-MM-DD");
  const action = requireEnum(input.action, "action", ["quantity", "complete", "review-reminder"] as const);
  const db = getDb();
  return db.transaction((tx: any) => idempotentOfflineMutation(tx, context, { key: typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined, organisationId: location.organisationId, locationId: location.id, operation: "markdown-sheet", payload: input }, async () => {
    const sheet = await ensureSheet(tx, location.id, dateKey, context.user.id);
    if (action === "review-reminder") {
      const reminderDate = previousDateKey(dateKey);
      await tx.update(markdownSheetItems).set({ reviewedAt: now(), reviewedBy: context.user.id }).where(and(eq(markdownSheetItems.locationId, location.id), eq(markdownSheetItems.sheetId, sheet.id)));
      const previous = await tx.select({ id: markdownSheets.id }).from(markdownSheets).where(and(eq(markdownSheets.locationId, location.id), eq(markdownSheets.dateKey, reminderDate))).limit(1);
      if (previous[0]) await tx.update(markdownSheetItems).set({ reviewedAt: now(), reviewedBy: context.user.id }).where(eq(markdownSheetItems.sheetId, previous[0].id));
      return { dateKey: reminderDate, reviewed: true, serverConfirmed: true };
    }
    const productId = requireUuid(input.productId, "productId");
    const mode = requireEnum(input.mode, "mode", modes);
    const [product] = await tx.select().from(markdownProducts).where(and(eq(markdownProducts.id, productId), eq(markdownProducts.locationId, location.id), eq(markdownProducts.active, true))).limit(1);
    if (!product) throw new ApiError(422, "Product is not available at this store");
    const [existing] = await tx.select().from(markdownSheetItems).where(and(eq(markdownSheetItems.sheetId, sheet.id), eq(markdownSheetItems.productId, product.id), eq(markdownSheetItems.mode, mode))).limit(1);
    if (action === "complete") {
      const memberId = await activeMember(location.id, requireUuid(input.teamMemberId, "teamMemberId")).then(member => member.id);
      if (!existing || existing.quantity < 1) throw new ApiError(422, "Add a quantity before completing this item");
      const completed = existing.completedAt === null;
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
  const [created] = await getDb().insert(markdownProducts).values({ locationId: location.id, name, order: 0 }).returning();
  return created;
}

