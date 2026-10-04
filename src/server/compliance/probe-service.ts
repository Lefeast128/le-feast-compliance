import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { foodChecks, issues, issueUpdates, probeProducts, rechecks } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { issueAndMember, locationFor, activeMember, now } from "./shared.js";
import { probeResult, requireFiniteNumber, requireString } from "./validation.js";

export async function recordFoodCheck(context: AuthContext, input: { locationId: string; product: string; quantity?: string; temperature: number; action?: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  const productName = requireString(input.product, "Product");
  const quantity = requireString(input.quantity, "Quantity");
  requireFiniteNumber(input.temperature, "temperature");
  const db = getDb();
  const productRows = await db.select().from(probeProducts).where(and(eq(probeProducts.organisationId, location.organisationId), eq(probeProducts.name, productName), eq(probeProducts.active, true)));
  const product = productRows.find(item => Array.isArray(item.locationIds) && item.locationIds.includes(location.id));
  if (!product) throw new ApiError(422, "No active probe product is configured for this location");
  return db.transaction(async (tx) => {
    const timestamp = now();
    const result = probeResult(input.temperature, product.minimumTemperature);
    const [check] = await tx.insert(foodChecks).values({ locationId: location.id, product: product.name, quantity, temperature: input.temperature, action: input.action?.trim() || null, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId, probeProductId: product.id, minimumTemperature: product.minimumTemperature, holdMinutes: product.holdMinutes }).returning({ id: foodChecks.id });
    let issueId: string | null = null;
    const correctiveAction = input.action?.trim();
    if (result === "fail") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Probe", title: `${product.name} probe below minimum`, description: `Recorded at ${input.temperature}°C for quantity ${quantity}. Configured minimum is ${product.minimumTemperature}°C.`, originalReading: `${input.temperature}°C`, sourceFoodCheckId: check.id, status: correctiveAction ? "monitoring" : "open", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId, action: correctiveAction || null }).returning({ id: issues.id });
      issueId = issue.id;
      if (correctiveAction) await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: correctiveAction, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { checkId: check.id, issueId, result };
  });
}
export async function addProbeRecheck(context: AuthContext, input: { issueId: string; temperature: number; teamMemberId: string }) {
  requireFiniteNumber(input.temperature, "temperature");
  const { db, issue, location } = await issueAndMember(context, input.issueId, input.teamMemberId, "Probe");
  const updates = await db.select().from(issueUpdates).where(eq(issueUpdates.issueId, issue.id));
  if (!updates.some(item => item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Corrective action is required before recheck");
  let minimum: number;
  let productName = "probe";
  if (issue.sourceFoodCheckId) {
    const [check] = await db.select().from(foodChecks).where(eq(foodChecks.id, issue.sourceFoodCheckId)).limit(1);
    if (!check || check.locationId !== location.id || check.minimumTemperature === null) throw new ApiError(422, "Original food check does not contain a temperature snapshot");
    minimum = check.minimumTemperature; productName = check.product;
  } else {
    const suffix = " probe below minimum";
    if (!issue.title.endsWith(suffix)) throw new ApiError(422, "Probe issue does not contain its original product");
    productName = issue.title.slice(0, -suffix.length).trim();
    const products = await db.select().from(probeProducts).where(and(eq(probeProducts.organisationId, location.organisationId), eq(probeProducts.name, productName), eq(probeProducts.active, true)));
    const product = products.find(item => Array.isArray(item.locationIds) && item.locationIds.includes(location.id));
    if (!product) throw new ApiError(422, "No active probe product is configured for this location");
    minimum = product.minimumTemperature;
  }
  return db.transaction(async (tx) => {
    const timestamp = now(); const result = probeResult(input.temperature, minimum);
    await tx.insert(rechecks).values({ issueId: issue.id, locationId: location.id, temperature: input.temperature, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    if (result === "pass") {
      const note = `Rechecked ${productName} at ${input.temperature}°C against snapshotted minimum ${minimum}°C`;
      await tx.update(issues).set({ status: "resolved", resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "resolution", note, status: "resolved", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    } else {
      await tx.update(issues).set({ status: "monitoring" }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "further_action", note: `Recheck for ${productName} remained below snapshotted minimum of ${minimum}°C at ${input.temperature}°C`, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { result };
  });
}
