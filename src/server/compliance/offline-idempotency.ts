import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { offlineSubmissions } from "../db/schema.js";
import { ApiError } from "./http.js";
import type { AuthContext } from "../auth/core.js";

const keyPattern = /^[A-Za-z0-9_-]{16,120}$/;
const hashPayload = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex");

// The callback runs in the same transaction as the claim and completion marker.
// This makes replay safe even when the network fails after the database commit.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function idempotentOfflineMutation(tx: any, context: AuthContext, input: { key?: string; organisationId: string; locationId: string; operation: string; payload: unknown }, work: () => Promise<unknown>) {
  if (!input.key) return work();
  if (!keyPattern.test(input.key)) throw new ApiError(400, "Invalid idempotency key");
  const payloadHash = hashPayload(input.payload);
  const [existing] = await tx.select().from(offlineSubmissions).where(eq(offlineSubmissions.submissionId, input.key)).limit(1);
  if (existing) {
    if (existing.organisationId !== input.organisationId || existing.locationId !== input.locationId || existing.userId !== context.user.id || existing.operation !== input.operation) throw new ApiError(409, "This submission key belongs to another workflow or account");
    if (existing.payloadHash && existing.payloadHash !== payloadHash) throw new ApiError(409, "This submission key was reused with different data");
    if (existing.status === "synced" && existing.response) return existing.response;
    throw new ApiError(409, "This submission is already being processed");
  }
  await tx.insert(offlineSubmissions).values({ submissionId: input.key, organisationId: input.organisationId, locationId: input.locationId, userId: context.user.id, operation: input.operation, payloadHash, status: "processing" });
  const response = await work();
  await tx.update(offlineSubmissions).set({ status: "synced", response, completedAt: new Date() }).where(and(eq(offlineSubmissions.submissionId, input.key), eq(offlineSubmissions.userId, context.user.id)));
  return response;
}
