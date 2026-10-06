import { and, eq } from "drizzle-orm";
import { checklistQuestions } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id, locationFor, text } from "./shared.js";
import { validateStructuredSteps } from "../compliance/structured-task-service.js";

const taskType = (value: unknown) => value === undefined ? "simple" : value === "with_steps" ? "with_steps" : value === "simple" ? "simple" : (() => { throw new ApiError(422, "Task type is invalid"); })();
const description = (value: unknown) => value === undefined || value === null || value === "" ? null : text(value, "Description");

async function checklistLocation(context: AuthContext, questionId: string) {
  const idValue = id(questionId, "questionId");
  const [row] = await db().select().from(checklistQuestions).where(eq(checklistQuestions.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Question not found");
  await locationFor(context, row.locationId);
  if (row.centralItemId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard checklist items are controlled centrally");
  return row;
}

export async function addChecklist(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const checklist = requireEnum(input.checklist, "checklist", ["opening", "closing"] as const);
  const question = text(input.question, "Question");
  const type = taskType(input.taskType);
  const steps = validateStructuredSteps(input.steps, type);
  const details = description(input.description);
  const rows = await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, checklist)));
  const [row] = await db().insert(checklistQuestions).values({ locationId: location.id, checklist, question, description: details, taskType: type, steps, order: rows.length, active: true }).returning();
  return row;
}

export async function updateChecklist(context: AuthContext, questionId: string, input: Record<string, unknown>) {
  const old = await checklistLocation(context, questionId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  const question = text(input.question, "Question");
  const type = taskType(input.taskType ?? old.taskType);
  const steps = validateStructuredSteps(input.steps ?? old.steps, type);
  const details = input.description === undefined ? old.description : description(input.description);
  return db().transaction(async tx => {
    const at = new Date();
    await tx.update(checklistQuestions).set({ active: false, deactivatedAt: at }).where(eq(checklistQuestions.id, old.id));
    const [row] = await tx.insert(checklistQuestions).values({ locationId: old.locationId, checklist: old.checklist, question, description: details, taskType: type, steps, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id, centralItemId: old.centralItemId }).returning();
    return row;
  });
}

export async function deleteChecklist(context: AuthContext, questionId: string) {
  const old = await checklistLocation(context, questionId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  await db().update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id));
  return { id: old.id, active: false };
}

export async function reorderChecklist(context: AuthContext, questionId: string, direction: unknown) {
  const old = await checklistLocation(context, questionId);
  requireEnum(direction, "direction", ["up", "down"] as const);
  const rows = (await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, old.locationId), eq(checklistQuestions.checklist, old.checklist), eq(checklistQuestions.active, true)))).sort((a, b) => a.order - b.order);
  const i = rows.findIndex(row => row.id === old.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || !rows[j]) return old;
  return db().transaction(async tx => {
    await tx.update(checklistQuestions).set({ order: rows[j].order }).where(eq(checklistQuestions.id, rows[i].id));
    await tx.update(checklistQuestions).set({ order: rows[i].order }).where(eq(checklistQuestions.id, rows[j].id));
    return rows[i];
  });
}
