import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { requireLocationManager } from "./permissions";
import {
  buildCatalogueChanges,
  assertCatalogueSize,
  mapCatalogueToLocations,
  normalizeCataloguePayload,
  type ComplianceLocation,
} from "./catalogueSync";

const catalogueInternal = internal as any;

const catalogueProductValidator = v.object({
  siteId: v.string(),
  locationId: v.id("locations"),
  plu: v.number(),
  name: v.string(),
  department: v.optional(v.string()),
  group: v.optional(v.string()),
  valueSources: v.object({
    name: v.string(),
    department: v.string(),
    group: v.string(),
  }),
});

const endpointUrl = () =>
  String(
    process.env.TOUCHOFFICE_CATALOG_ENDPOINT_URL ||
      "https://lefeast-code-pearl.vercel.app/api/touchoffice-product-catalog",
  ).trim();

async function readCatalogue() {
  const secret = String(process.env.TOUCHOFFICE_CATALOG_API_SECRET || "").trim();
  if (!secret) throw new Error("TouchOffice catalogue secret is not configured");

  const response = await fetch(endpointUrl(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secret}`,
    },
  });
  if (!response.ok) throw new Error(`TouchOffice catalogue request failed (${response.status})`);

  return normalizeCataloguePayload(await response.json());
}

async function locationsForProducts(ctx: any, products: ReturnType<typeof normalizeCataloguePayload>["products"]) {
  const locations = await ctx.runQuery(catalogueInternal.catalogue.activeLocations, {});
  return mapCatalogueToLocations(products, locations as ComplianceLocation[]);
}

export const activeLocations = internalQuery({
  args: {},
  handler: async ctx => {
    return (await ctx.db.query("locations").collect())
      .filter(location => location.active)
      .map(location => ({ _id: location._id, name: location.name, shortName: location.shortName }));
  },
});

export const canRefresh = internalQuery({
  args: { userId: v.id("users"), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user", q => q.eq("userId", args.userId))
      .collect();
    return membership.some(
      item =>
        item.locationId === args.locationId &&
        (item.role === "manager" || item.role === "admin"),
    );
  },
});

export const applyLocationSync = internalMutation({
  args: {
    locationId: v.id("locations"),
    siteId: v.string(),
    syncedAt: v.number(),
    products: v.array(catalogueProductValidator),
  },
  handler: async (ctx, args) => {
    const db: any = ctx.db;
    const current = await db
      .query("catalogueProducts")
      .withIndex("by_location", (q: any) => q.eq("locationId", args.locationId))
      .collect();
    assertCatalogueSize(current, args.products);
    const changes = buildCatalogueChanges(current as any, args.products as any, args.syncedAt);
    for (const product of changes.upserts) {
      const existing = current.find((item: any) => item.plu === product.plu);
      if (existing) {
        await db.patch(existing._id, {
          siteId: product.siteId,
          name: product.name,
          department: product.department,
          group: product.group,
          valueSources: product.valueSources,
          active: product.active,
          needsCategoryReview: product.needsCategoryReview,
          lastSeenAt: product.lastSeenAt,
          lastSuccessfulSyncAt: product.lastSuccessfulSyncAt,
        });
      } else {
        await db.insert("catalogueProducts", {
          locationId: args.locationId,
          siteId: product.siteId,
          plu: product.plu,
          name: product.name,
          department: product.department,
          group: product.group,
          valueSources: product.valueSources,
          active: product.active,
          needsCategoryReview: product.needsCategoryReview,
          firstSeenAt: product.firstSeenAt,
          lastSeenAt: product.lastSeenAt,
          lastSuccessfulSyncAt: product.lastSuccessfulSyncAt,
        });
      }
    }

    for (const product of changes.removals) {
      await db.patch(product._id, {
        active: false,
        lastSuccessfulSyncAt: product.lastSuccessfulSyncAt,
      });
    }

    const status = await db
      .query("catalogueSyncStatus")
      .withIndex("by_location", (q: any) => q.eq("locationId", args.locationId))
      .first();
    const statusData = {
      locationId: args.locationId,
      lastSuccessfulSyncAt: args.syncedAt,
      lastAttemptedSyncAt: args.syncedAt,
      lastError: undefined,
      productCount: args.products.length,
      addedCount: changes.summary.added,
      renamedCount: changes.summary.renamed,
      removedCount: changes.summary.removed,
    };
    if (status) await db.patch(status._id, statusData);
    else await db.insert("catalogueSyncStatus", statusData);

    return changes.summary;
  },
});

export const recordSyncFailure = internalMutation({
  args: {
    locationIds: v.array(v.id("locations")),
    attemptedAt: v.number(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const db: any = ctx.db;
    for (const locationId of args.locationIds) {
      const status = await db
        .query("catalogueSyncStatus")
        .withIndex("by_location", (q: any) => q.eq("locationId", locationId))
        .first();
      const patch = {
        locationId,
        lastAttemptedSyncAt: args.attemptedAt,
        lastError: args.error.slice(0, 300),
      };
      if (status) await db.patch(status._id, patch);
      else await db.insert("catalogueSyncStatus", patch);
    }
  },
});

async function syncProducts(ctx: any, locationId?: string) {
  const now = Date.now();
  try {
    const catalogue = await readCatalogue();
    const mapped = await locationsForProducts(ctx, catalogue.products);
    const locations = await ctx.runQuery(catalogueInternal.catalogue.activeLocations, {});
    const targets = locationId
      ? locations.filter((location: any) => location._id === locationId)
      : locations;
    const results = [];
    for (const location of targets) {
      const products = mapped.filter(product => product.locationId === location._id);
      if (!products.length) throw new Error(`TouchOffice catalogue has no products for ${location.name}`);
      results.push(
        await ctx.runMutation(catalogueInternal.catalogue.applyLocationSync, {
          locationId: location._id,
          siteId: products[0].siteId,
          syncedAt: now,
          products,
        }),
      );
    }
    return { ok: true, retrievedAt: catalogue.retrievedAt, results };
  } catch (error) {
    const locations = await ctx.runQuery(catalogueInternal.catalogue.activeLocations, {});
    const targetIds = locationId
      ? locations.filter((location: any) => location._id === locationId).map((location: any) => location._id)
      : locations.map((location: any) => location._id);
    await ctx.runMutation(catalogueInternal.catalogue.recordSyncFailure, {
      locationIds: targetIds,
      attemptedAt: now,
      error: error instanceof Error ? error.message : "Catalogue sync failed",
    });
    return { ok: false, error: "Catalogue sync failed" };
  }
}

export const requestRefresh = action({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");
    const allowed = await ctx.runQuery(catalogueInternal.catalogue.canRefresh, {
      userId,
      locationId: args.locationId,
    });
    if (!allowed) throw new Error("Manager access required");
    return await syncProducts(ctx, args.locationId);
  },
});

export const scheduledSync = internalAction({
  args: {},
  handler: async ctx => syncProducts(ctx),
});

export const list = query({
  args: { locationId: v.id("locations") },
  handler: async (ctx, args) => {
    await requireLocationManager(ctx, args.locationId);
    const db: any = ctx.db;
    const products = await db
      .query("catalogueProducts")
      .withIndex("by_location", (q: any) => q.eq("locationId", args.locationId))
      .collect();
    const syncStatus = await db
      .query("catalogueSyncStatus")
      .withIndex("by_location", (q: any) => q.eq("locationId", args.locationId))
      .first();
    return {
      products: products.filter((product: any) => product.active).sort((a: any, b: any) => a.plu - b.plu),
      syncStatus,
    };
  },
});
