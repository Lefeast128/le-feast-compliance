import { and, eq, gte, lt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { securityQuestions, securityResponses, securitySignOffs } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { localDateKey, localDayRange, requireEnum } from "./validation.js";
import { maybeAutoSignOffStructuredChecklist } from "./structured-task-service.js";

export async function saveSecurityResponse(context: AuthContext, input: { locationId: string; session: "AM" | "PM"; questionId: string; issue?: string; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  const [question] = await db.select().from(securityQuestions).where(and(eq(securityQuestions.id, input.questionId), eq(securityQuestions.locationId, location.id))).limit(1);
  if (!question) throw new ApiError(422, "Security question does not belong to this location"); if (question.session !== input.session) throw new ApiError(422, "Security question does not match this session"); if (!question.active) throw new ApiError(422, "This configuration version is no longer active");
  if (question.completionMode === "task") throw new ApiError(422, "Simple completion tasks must use the structured task workflow");
  const range = localDayRange(Date.now(), location.timezone);
  return db.transaction(async (tx) => {
    const existing = await tx.select({ id: securityResponses.id }).from(securityResponses).where(and(eq(securityResponses.locationId, location.id), eq(securityResponses.session, input.session), eq(securityResponses.questionId, question.id), gte(securityResponses.createdAt, new Date(range.start)), lt(securityResponses.createdAt, new Date(range.end))));
    if (existing.length) throw new ApiError(409, "Security question already answered today");
    const timestamp = now();
    const [response] = await tx.insert(securityResponses).values({ locationId: location.id, session: input.session, questionId: question.id, answer: "yes", issue: input.issue?.trim() || null, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId ?? null }).returning({ id: securityResponses.id });
    await maybeAutoSignOffStructuredChecklist(tx, { locationId: location.id, area: input.session === "AM" ? "security_am" : "security_pm", dateKey: localDateKey(timestamp.getTime(), location.timezone), timezone: location.timezone, completedBy: context.user.id, teamMemberId: input.teamMemberId });
    return { responseId: response.id };
  });
}
export async function signOffSecurity(context: AuthContext, input: { locationId: string; session: "AM" | "PM"; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  return db.transaction(async (tx) => {
    const dateKey = localDateKey(Date.now(), location.timezone); const existing = await tx.select().from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), eq(securitySignOffs.session, input.session), eq(securitySignOffs.dateKey, dateKey))).limit(1); if (existing[0]) return { signoffId: existing[0].id, existing: true };
    const questions = await tx.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, input.session), eq(securityQuestions.active, true))); if (!questions.length) throw new ApiError(422, "No active security questions exist for this location"); if (questions.some((question) => question.taskType === "with_steps" || question.completionMode === "task")) throw new ApiError(422, "This security check must use the structured task workflow");
    const range = localDayRange(Date.now(), location.timezone); const responses = await tx.select({ questionId: securityResponses.questionId }).from(securityResponses).where(and(eq(securityResponses.locationId, location.id), eq(securityResponses.session, input.session), gte(securityResponses.createdAt, new Date(range.start)), lt(securityResponses.createdAt, new Date(range.end)))); const ids = new Set(responses.map((item) => item.questionId)); if (questions.some((question) => !ids.has(question.id))) throw new ApiError(422, "Every active security question must have a response today");
    const [signoff] = await tx.insert(securitySignOffs).values({ locationId: location.id, session: input.session, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [securitySignOffs.locationId, securitySignOffs.session, securitySignOffs.dateKey] }).returning({ id: securitySignOffs.id });
    if (!signoff) {
      const [existingSignoff] = await tx.select({ id: securitySignOffs.id }).from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), eq(securitySignOffs.session, input.session), eq(securitySignOffs.dateKey, dateKey))).limit(1);
      return { signoffId: existingSignoff.id, existing: true };
    }
    return { signoffId: signoff.id, existing: false };
  });
}
