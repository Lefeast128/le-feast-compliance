import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { checklistQuestions, checklistResponses, checklistSignOffs, issueUpdates, issues } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { localDateKey, localDayRange, requireEnum, requireUuid } from "./validation.js";

export async function saveChecklistResponse(context: AuthContext, input: { locationId: string; checklist: "opening" | "closing"; questionId: string; answer: "yes" | "no" | "na"; problem?: string; action?: string; teamMemberId: string }) {
  requireEnum(input.checklist, "checklist", ["opening", "closing"] as const); requireEnum(input.answer, "answer", ["yes", "no", "na"] as const);
  const location = await locationFor(context, input.locationId); requireUuid(input.questionId, "questionId");
  await activeMember(location.id, input.teamMemberId);
  if (input.answer === "no" && !input.action?.trim()) throw new ApiError(422, "A corrective action is required");
  const db = getDb();
  return db.transaction(async (tx) => {
    const [question] = await tx.select().from(checklistQuestions).where(and(eq(checklistQuestions.id, input.questionId), eq(checklistQuestions.locationId, location.id))).limit(1);
    if (!question) throw new ApiError(422, "Checklist question does not belong to this location");
    if (question.checklist !== input.checklist) throw new ApiError(422, "Checklist question does not match this checklist");
    if (!question.active) throw new ApiError(422, "This configuration version is no longer active");
    const range = localDayRange(Date.now(), location.timezone);
    const existing = await tx.select({ id: checklistResponses.id }).from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), eq(checklistResponses.questionId, question.id), eq(checklistResponses.checklist, input.checklist), gte(checklistResponses.createdAt, new Date(range.start)), lt(checklistResponses.createdAt, new Date(range.end))));
    if (existing.length) throw new ApiError(409, "Checklist question already answered today");
    const timestamp = now();
    const [response] = await tx.insert(checklistResponses).values({ locationId: location.id, checklist: input.checklist, questionId: question.id, answer: input.answer, problem: input.problem?.trim() || null, action: input.action?.trim() || null, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId ?? null }).returning({ id: checklistResponses.id });
    if (input.answer === "no") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Food safety", title: `${input.checklist} checklist: ${question.question}`, description: input.problem?.trim() || question.question, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId!, action: input.action!.trim() }).returning({ id: issues.id });
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: input.action!.trim(), status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId! });
    }
    return { responseId: response.id };
  });
}
export async function signOffChecklist(context: AuthContext, input: { locationId: string; checklist: "opening" | "closing"; teamMemberId: string }) {
  requireEnum(input.checklist, "checklist", ["opening", "closing"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  return db.transaction(async (tx) => {
    const dateKey = localDateKey(Date.now(), location.timezone);
    const existing = await tx.select().from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), eq(checklistSignOffs.checklist, input.checklist), eq(checklistSignOffs.dateKey, dateKey))).limit(1);
    if (existing[0]) return { signoffId: existing[0].id, existing: true };
    const questions = await tx.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, input.checklist), eq(checklistQuestions.active, true)));
    if (!questions.length) throw new ApiError(422, "No active checklist questions exist for this location");
    const range = localDayRange(Date.now(), location.timezone);
    const responses = await tx.select({ questionId: checklistResponses.questionId }).from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), eq(checklistResponses.checklist, input.checklist), gte(checklistResponses.createdAt, new Date(range.start)), lt(checklistResponses.createdAt, new Date(range.end))));
    const responseIds = new Set(responses.map((item) => item.questionId)); if (questions.some((question) => !responseIds.has(question.id))) throw new ApiError(422, "Every active checklist question must have a response today");
    const [signoff] = await tx.insert(checklistSignOffs).values({ locationId: location.id, checklist: input.checklist, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [checklistSignOffs.locationId, checklistSignOffs.checklist, checklistSignOffs.dateKey] }).returning({ id: checklistSignOffs.id });
    if (!signoff) {
      const [existingSignoff] = await tx.select({ id: checklistSignOffs.id }).from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), eq(checklistSignOffs.checklist, input.checklist), eq(checklistSignOffs.dateKey, dateKey))).limit(1);
      return { signoffId: existingSignoff.id, existing: true };
    }
    return { signoffId: signoff.id, existing: false };
  });
}
