import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, issueUpdates, issues, rechecks } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { captureTime, requireEnum, requireString, requireUuid } from "./validation.js";
import { idempotentOfflineMutation } from "./offline-idempotency.js";

export async function addIssueAction(context: AuthContext, input: { issueId: string; action: string; teamMemberId: string; idempotencyKey?: string; capturedAt?: string }) {
  requireUuid(input.issueId, "issueId");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, input.teamMemberId);
  const action = requireString(input.action, "Corrective action");
  return db.transaction(async (tx) => idempotentOfflineMutation(tx, context, { key: input.idempotencyKey, organisationId: location.organisationId, locationId: location.id, operation: "issue-update", payload: input }, async () => {
    if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed");
    const timestamp = now();
    const capturedAt = input.capturedAt === undefined ? null : captureTime(input.capturedAt);
    await tx.update(issues).set({ action }).where(eq(issues.id, issue.id));
    await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: action, status: issue.status, createdAt: timestamp, capturedAt, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "corrective_action_added", detail: action, createdAt: timestamp });
    return { issueId: issue.id, status: issue.status };
  }));
}

export async function createManualIssue(context: AuthContext, input: { locationId: string; description: string; teamMemberId: string; idempotencyKey?: string; capturedAt?: string }) {
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  const description = requireString(input.description, "Issue description");
  const db = getDb();
  return db.transaction(async tx => idempotentOfflineMutation(tx, context, { key: input.idempotencyKey, organisationId: location.organisationId, locationId: location.id, operation: "issue-update", payload: input }, async () => {
    const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Food safety", title: "Manual issue reported", description, status: "open", createdAt: now(), capturedAt: input.capturedAt === undefined ? null : captureTime(input.capturedAt), createdBy: context.user.id, teamMemberId: input.teamMemberId }).returning({ id: issues.id });
    return { issueId: issue.id };
  }));
}

export async function addIssueUpdate(context: AuthContext, input: { issueId: string; note: string; status: "open" | "monitoring" | "resolved"; updateType: "further_action" | "resolution" | "status_change"; teamMemberId: string; idempotencyKey?: string; capturedAt?: string }) {
  requireUuid(input.issueId, "issueId");
  requireEnum(input.status, "status", ["open", "monitoring", "resolved"] as const);
  requireEnum(input.updateType, "updateType", ["further_action", "resolution", "status_change"] as const);
  const note = requireString(input.note, "Issue update");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, input.teamMemberId);
  return db.transaction(async (tx) => idempotentOfflineMutation(tx, context, { key: input.idempotencyKey, organisationId: location.organisationId, locationId: location.id, operation: "issue-update", payload: input }, async () => {
    if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed");
    if (input.status === "resolved" && issue.category === "Temperature") {
      const immediate = await tx.select({ id: issueUpdates.id }).from(issueUpdates).where(and(eq(issueUpdates.issueId, issue.id), eq(issueUpdates.updateType, "immediate_action"))).limit(1);
      if (!immediate.length) throw new ApiError(422, "Corrective action is required before resolution");
    }
    if (input.status === "resolved" && issue.category === "Probe") {
      const recheckRows = await tx.select({ result: rechecks.result }).from(rechecks).where(eq(rechecks.issueId, issue.id));
      if (!recheckRows.some(row => row.result === "pass")) throw new ApiError(422, "Temperature and probe issues must be resolved by a passing recheck");
    }
    if (input.status === "resolved" && input.updateType !== "resolution") throw new ApiError(422, "Resolved issue update must be a resolution");
    if (input.updateType === "resolution" && input.status !== "resolved") throw new ApiError(422, "Resolution update must resolve the issue");
    const timestamp = now();
    const capturedAt = input.capturedAt === undefined ? null : captureTime(input.capturedAt);
    await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: input.updateType, note, status: input.status, createdAt: timestamp, capturedAt, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    await tx.update(issues).set({ status: input.status, ...(input.status === "resolved" ? { resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note } : {}) }).where(eq(issues.id, issue.id));
    return { issueId: issue.id, status: input.status };
  }));
}
