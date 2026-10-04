import { eq } from "drizzle-orm";
import { locations, probeProducts } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { db, audit, finite, id, locationFor, text } from "./shared.js";

export async function addProbe(context: AuthContext, input: Record<string, unknown>) {
  const name = text(input.name, "Name");
  const minimumTemperature = finite(input.minimumTemperature, "minimumTemperature");
  const holdMinutes = finite(input.holdMinutes, "holdMinutes");
  if (!Number.isInteger(holdMinutes) || holdMinutes < 1) throw new ApiError(422, "holdMinutes must be a positive whole number");
  const rawLocationIds = input.locationIds;
  if (!Array.isArray(rawLocationIds) || !rawLocationIds.length) throw new ApiError(422, "At least one location is required");
  const locationIds = rawLocationIds.map(locationId => id(locationId, "locationId"));
  for (const locationId of locationIds) await locationFor(context, locationId);
  const [org] = await db().select({ organisationId: locations.organisationId }).from(locations).where(eq(locations.id, locationIds[0])).limit(1);
  if (!org) throw new ApiError(404, "Location not found");
  return db().insert(probeProducts).values({ organisationId: org.organisationId, name, minimumTemperature, holdMinutes, locationIds, active: true }).returning();
}

export async function updateProbe(context: AuthContext, productId: string, input: Record<string, unknown>) {
  const idValue = id(productId, "productId");
  const [old] = await db().select().from(probeProducts).where(eq(probeProducts.id, idValue)).limit(1);
  if (!old) throw new ApiError(404, "Probe product not found");
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  for (const locationId of old.locationIds ?? []) await locationFor(context, id(locationId, "locationId"));
  const name = text(input.name, "Name");
  const minimumTemperature = finite(input.minimumTemperature, "minimumTemperature");
  const holdMinutes = finite(input.holdMinutes, "holdMinutes");
  if (!Number.isInteger(holdMinutes) || holdMinutes < 1) throw new ApiError(422, "holdMinutes must be a positive whole number");
  return db().transaction(async tx => {
    const at = new Date();
    await tx.update(probeProducts).set({ active: false, deactivatedAt: at }).where(eq(probeProducts.id, old.id));
    const [row] = await tx.insert(probeProducts).values({ organisationId: old.organisationId, name, minimumTemperature, holdMinutes, locationIds: old.locationIds, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning();
    await audit(tx, null, context.user.id, "probe_product_updated", name);
    return row;
  });
}

export async function deleteProbe(context: AuthContext, productId: string) {
  const idValue = id(productId, "productId");
  const [row] = await db().select().from(probeProducts).where(eq(probeProducts.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Probe product not found");
  if (!row.active) throw new ApiError(409, "This configuration version is no longer active");
  for (const locationId of row.locationIds ?? []) await locationFor(context, id(locationId, "locationId"));
  await db().update(probeProducts).set({ active: false, deactivatedAt: new Date() }).where(eq(probeProducts.id, row.id));
  return { id: row.id, active: false };
}
