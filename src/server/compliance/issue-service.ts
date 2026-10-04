import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, issueUpdates, issues } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { requireEnum, requireString, requireUuid } from "./validation.js";

export async function addIssueAction(context: AuthContext, input: { issueId: string; action: string; teamMemberId: string }) {
  requireUuid(input.issueId, "issueId");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, input.teamMemberId);
  const action = requireString(input.action, "Corrective action");
  if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed");
  return db.transaction(async (tx) => {
    const timestamp = now();
    await tx.update(issues).set({ action, status: "monitoring" }).where(eq(issues.id, issue.id));
    await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: action, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "corrective_action_added", detail: action, createdAt: timestamp });
    return { issueId: issue.id, status: "monitoring" };
  });
}

export async function createManualIssue(context: AuthContext, input: { locationId: string; description: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const description = requireString(input.description, "Issue description"); const db = getDb(); const [issue] = await db.insert(issues).values({ locationId: location.id, category: "Food safety", title: "Manual issue reported", description, status: "open", createdAt: now(), createdBy: context.user.id, teamMemberId: input.teamMemberId }).returning({ id: issues.id }); return { issueId: issue.id };
}

export async function addIssueUpdate(context: AuthContext, input: { issueId: string; note: string; status: "open" | "monitoring" | "resolved"; updateType: "further_action" | "resolution" | "status_change"; teamMemberId: string }) {
  requireUuid(input.issueId, "issueId");
  requireEnum(input.status, "status", ["open", "monitoring", "resolved"] as const); requireEnum(input.updateType, "updateType", ["further_action", "resolution", "status_change"] as const);
  const db = getDb(); const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1); if (!issue) throw new ApiError(404, "Issue not found"); const location = await locationFor(context, issue.locationId); await activeMember(location.id, input.teamMemberId); if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed"); if (input.status === "resolved" && (issue.category === "Temperature" || issue.category === "Probe")) throw new ApiError(422, "Temperature and probe issues must be resolved by a passing recheck"); if (input.status === "resolved" && input.updateType !== "resolution") throw new ApiError(422, "Resolved issue update must be a resolution"); if (input.updateType === "resolution" && input.status !== "resolved") throw new ApiError(422, "Resolution update must resolve the issue"); const note = requireString(input.note, "Issue update"); return db.transaction(async (tx) => { const timestamp = now(); await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: input.updateType, note, status: input.status, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId }); await tx.update(issues).set({ status: input.status, ...(input.status === "resolved" ? { resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note } : {}) }).where(eq(issues.id, issue.id)); return { issueId: issue.id, status: input.status }; });
}
