/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { catalogueProducts, catalogueSyncStatus, locations } from "../db/schema.js";
import { requireLocationManager, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireUuid } from "../compliance/validation.js";
import { withJobLock } from "../jobs/lock.js";
import { assertCatalogueSize, buildCatalogueChanges, mapCatalogueToLocations, normalizeCataloguePayload, type CatalogueProduct } from "./pure.js";

const endpoint = () => (process.env.TOUCHOFFICE_CATALOG_ENDPOINT_URL || "https://lefeast-code-pearl.vercel.app/api/touchoffice-product-catalog").trim();
const safeError = (error: unknown) => (error instanceof Error ? error.message : "Catalogue sync failed").replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);

async function fetchCatalogue() {
  const secret = process.env.TOUCHOFFICE_CATALOG_API_SECRET?.trim();
  if (!secret) throw new ApiError(503, "TouchOffice catalogue secret is not configured");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint(), { headers: { Accept: "application/json", Authorization: `Bearer ${secret}` }, signal: controller.signal });
    if (!response.ok) throw new Error(`TouchOffice catalogue request failed (${response.status})`);
    return normalizeCataloguePayload(await response.json());
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("TouchOffice catalogue request timed out");
    throw error;
  } finally { clearTimeout(timeout); }
}

async function activeLocations() {
  return getDb().select().from(locations).where(eq(locations.active, true));
}

async function recordFailure(locationIds: string[], attemptedAt: Date, error: unknown) {
  if (!locationIds.length) return;
  const message = safeError(error);
  await getDb().transaction(async tx => {
    for (const locationId of locationIds) {
      await tx.insert(catalogueSyncStatus).values({ locationId, lastAttemptedSyncAt: attemptedAt, lastError: message }).onConflictDoUpdate({ target: catalogueSyncStatus.locationId, set: { lastAttemptedSyncAt: attemptedAt, lastError: message } });
    }
  });
}

async function applyLocation(location: typeof locations.$inferSelect, products: Array<CatalogueProduct & { locationId: string }>, syncedAt: Date) {
  return getDb().transaction(async tx => {
    const existing = await tx.select().from(catalogueProducts).where(eq(catalogueProducts.locationId, location.id));
    assertCatalogueSize(existing, products);
    const changes = buildCatalogueChanges(existing.map(row => ({ ...row, firstSeenAt: row.firstSeenAt })), products, syncedAt);
    for (const product of changes.upserts) {
      const current = existing.find(item => item.plu === product.plu);
      if (current) {
        await tx.update(catalogueProducts).set({ siteId: product.siteId, name: product.name, department: product.department, group: product.group, valueSources: product.valueSources, active: true, needsCategoryReview: product.needsCategoryReview, lastSeenAt: product.lastSeenAt, lastSuccessfulSyncAt: product.lastSuccessfulSyncAt }).where(eq(catalogueProducts.id, current.id));
      } else {
        await tx.insert(catalogueProducts).values({ locationId: location.id, siteId: product.siteId, plu: product.plu, name: product.name, department: product.department, group: product.group, valueSources: product.valueSources, active: true, needsCategoryReview: true, firstSeenAt: product.firstSeenAt, lastSeenAt: product.lastSeenAt, lastSuccessfulSyncAt: product.lastSuccessfulSyncAt });
      }
    }
    for (const removed of changes.removals) await tx.update(catalogueProducts).set({ active: false, lastSuccessfulSyncAt: syncedAt }).where(eq(catalogueProducts.id, removed.id));
    await tx.insert(catalogueSyncStatus).values({ locationId: location.id, lastSuccessfulSyncAt: syncedAt, lastAttemptedSyncAt: syncedAt, lastError: null, productCount: products.length, addedCount: changes.summary.added, renamedCount: changes.summary.renamed, removedCount: changes.summary.removed }).onConflictDoUpdate({ target: catalogueSyncStatus.locationId, set: { lastSuccessfulSyncAt: syncedAt, lastAttemptedSyncAt: syncedAt, lastError: null, productCount: products.length, addedCount: changes.summary.added, renamedCount: changes.summary.renamed, removedCount: changes.summary.removed } });
    return changes.summary;
  });
}

async function syncLocation(location: typeof locations.$inferSelect, mapped: Array<CatalogueProduct & { locationId: string }>, retrievedAt: string) {
  return withJobLock(`catalogue:${location.id}`, async () => {
    const products = mapped.filter(product => product.locationId === location.id);
    if (!products.length) throw new Error(`TouchOffice catalogue has no products for ${location.name}`);
    return applyLocation(location, products, new Date()).then(summary => ({ ...summary, retrievedAt }));
  });
}

export async function refreshCatalogue(context: AuthContext, locationId: string) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(and(eq(locations.id, locationId), eq(locations.active, true))).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  const attemptedAt = new Date();
  try {
    const payload = await fetchCatalogue();
    const mapped = mapCatalogueToLocations(payload.products, await activeLocations());
    const result = await syncLocation(location, mapped, payload.retrievedAt);
    if (result.skipped) return { ok: true, skipped: true, reason: "already_running" };
    return { ok: true, locationId, ...result.value };
  } catch (error) {
    await recordFailure([location.id], attemptedAt, error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "TouchOffice catalogue sync failed");
  }
}

export async function scheduledCatalogueSync() {
  const startedAt = Date.now();
  const targetLocations = await activeLocations();
  try {
    const payload = await fetchCatalogue();
    const mapped = mapCatalogueToLocations(payload.products, targetLocations);
    const results: any[] = [];
    for (const location of targetLocations) {
      try {
        const result = await syncLocation(location, mapped, payload.retrievedAt);
        results.push({ locationId: location.id, ...(result.skipped ? { skipped: true } : result.value) });
      } catch (error) {
        await recordFailure([location.id], new Date(), error);
        results.push({ locationId: location.id, ok: false, error: safeError(error) });
      }
    }
    const summary = results.reduce((total, item) => ({ added: total.added + (item.added ?? 0), renamed: total.renamed + (item.renamed ?? 0), removed: total.removed + (item.removed ?? 0) }), { added: 0, renamed: 0, removed: 0 });
    console.info("catalogue-sync", { job: "catalogue", startedAt: new Date(startedAt).toISOString(), completedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, ok: results.every(item => item.ok !== false), locations: results.length, ...summary });
    return { ok: results.every(item => item.ok !== false), locations: results.length, ...summary, results };
  } catch (error) {
    await recordFailure(targetLocations.map(location => location.id), new Date(), error);
    console.error("catalogue-sync", { job: "catalogue", durationMs: Date.now() - startedAt, ok: false, error: safeError(error) });
    throw error instanceof ApiError ? error : new ApiError(502, "TouchOffice catalogue sync failed");
  }
}

export async function listCatalogue(context: AuthContext, locationId: string) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(and(eq(locations.id, locationId), eq(locations.active, true))).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  const [products, status] = await Promise.all([getDb().select().from(catalogueProducts).where(and(eq(catalogueProducts.locationId, location.id), eq(catalogueProducts.active, true))).orderBy(asc(catalogueProducts.plu)), getDb().select().from(catalogueSyncStatus).where(eq(catalogueSyncStatus.locationId, location.id)).limit(1)]);
  return { products, syncStatus: status[0] ?? null };
}
