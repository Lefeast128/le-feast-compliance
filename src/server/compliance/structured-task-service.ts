import { and, asc, eq, gte, lt } from "drizzle-orm";
import type { AuthContext } from "../auth/core.js";
import { requireLocationAccess } from "../auth/core.js";
import { getDb } from "../db/client.js";
import {
  checklistQuestions,
  checklistResponses,
  checklistSignOffs,
  cleaningTasks,
  issues,
  issueUpdates,
  locations,
  securityQuestions,
  securityResponses,
  securitySignOffs,
  structuredTaskResponses,
  type StructuredStepDefinition,
  type StructuredStepResponseType,
} from "../db/schema.js";
import { ApiError } from "./errors.js";
import { localDateKey, localDayRange } from "../dashboard/time.js";
import { activeMember } from "./shared.js";
import { id, locationFor, text } from "../management/shared.js";

export const structuredAreas = ["opening", "closing", "cleaning", "security_am", "security_pm"] as const;
export type StructuredTaskArea = typeof structuredAreas[number];
export const structuredTaskTypes = ["simple", "with_steps"] as const;
export type StructuredTaskType = typeof structuredTaskTypes[number];
export const stepResponseTypes = ["confirm", "yes_no", "number", "short_text"] as const;

type TaskRow = typeof checklistQuestions.$inferSelect | typeof cleaningTasks.$inferSelect | typeof securityQuestions.$inferSelect;
type TaskTable = typeof checklistQuestions | typeof cleaningTasks | typeof securityQuestions;

const db = () => getDb();

const areaTable = (area: StructuredTaskArea): TaskTable => {
  if (area === "opening" || area === "closing") return checklistQuestions;
  if (area === "cleaning") return cleaningTasks;
  return securityQuestions;
};

const taskId = (value: unknown) => id(value, "taskId");

export function validateStructuredSteps(value: unknown, taskType: StructuredTaskType): StructuredStepDefinition[] {
  if (!Array.isArray(value)) {
    if (taskType === "simple") return [];
    throw new ApiError(422, "At least one task step is required");
  }
  const ids = new Set<string>();
  const steps = value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new ApiError(422, `Step ${index + 1} is invalid`);
    const item = raw as Record<string, unknown>;
    const stepId = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `step_${index + 1}`;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    const responseType = item.responseType;
    if (!label || typeof responseType !== "string" || !stepResponseTypes.includes(responseType as StructuredStepResponseType)) {
      throw new ApiError(422, `Step ${index + 1} is invalid`);
    }
    if (ids.has(stepId)) throw new ApiError(422, "Step identifiers must be unique");
    ids.add(stepId);
    return {
      id: stepId,
      label,
      description: typeof item.description === "string" && item.description.trim() ? item.description.trim() : null,
      responseType: responseType as StructuredStepResponseType,
      required: item.required !== false,
    } satisfies StructuredStepDefinition;
  });
  if (taskType === "with_steps" && !steps.length) throw new ApiError(422, "At least one task step is required");
  return steps;
}

function taskTypeOf(input: Record<string, unknown>, existing?: TaskRow): StructuredTaskType {
  const value = input.taskType ?? existing?.taskType ?? "simple";
  if (typeof value !== "string" || !structuredTaskTypes.includes(value as StructuredTaskType)) throw new ApiError(422, "Task type is invalid");
  return value as StructuredTaskType;
}

function completionModeOf(input: Record<string, unknown>, existing?: TaskRow) {
  const value = input.completionMode ?? existing?.completionMode ?? ("name" in (existing ?? {}) ? "task" : "question");
  if (value !== "task" && value !== "question") throw new ApiError(422, "Completion mode is invalid");
  return value as "task" | "question";
}

function rowTitle(row: TaskRow) {
  return "name" in row ? row.name : row.question;
}

function rowArea(row: TaskRow): StructuredTaskArea {
  if ("checklist" in row) return row.checklist;
  if ("session" in row) return row.session === "AM" ? "security_am" : "security_pm";
  return "cleaning";
}

function dto(row: TaskRow) {
  const area = rowArea(row);
  return {
    id: row.id,
    locationId: row.locationId,
    area,
    title: rowTitle(row),
    question: "question" in row ? row.question : undefined,
    name: "name" in row ? row.name : undefined,
    description: row.description,
    taskType: (row.taskType ?? "simple") as StructuredTaskType,
    completionMode: row.completionMode ?? ("name" in row ? "task" : "question"),
    steps: (row.steps ?? []) as StructuredStepDefinition[],
    checklist: "checklist" in row ? row.checklist : undefined,
    session: "session" in row ? row.session : undefined,
    frequency: "frequency" in row ? row.frequency : undefined,
    weekdays: "weekdays" in row ? row.weekdays : undefined,
    centralItemId: row.centralItemId,
    active: row.active,
    order: row.order,
    versionRootId: row.versionRootId,
  };
}

async function findActiveTask(area: StructuredTaskArea, rawTaskId: unknown, locationId: string, executor = db()): Promise<TaskRow> {
  const parsedId = taskId(rawTaskId);
  const table = areaTable(area);
  const [row] = await executor.select().from(table).where(and(eq(table.id, parsedId), eq(table.locationId, locationId), eq(table.active, true))).limit(1);
  if (!row) throw new ApiError(404, "Structured task not found");
  return row as TaskRow;
}

export async function listStructuredTasks(context: AuthContext, input: { locationId: string; date?: string }) {
  const locationId = id(input.locationId, "locationId");
  const location = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location[0]) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, locationId, location[0].organisationId);
  const [checklists, cleaning, security] = await Promise.all([
    db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, locationId), eq(checklistQuestions.active, true))).orderBy(asc(checklistQuestions.order)),
    db().select().from(cleaningTasks).where(and(eq(cleaningTasks.locationId, locationId), eq(cleaningTasks.active, true))).orderBy(asc(cleaningTasks.order)),
    db().select().from(securityQuestions).where(and(eq(securityQuestions.locationId, locationId), eq(securityQuestions.active, true))).orderBy(asc(securityQuestions.order)),
  ]);
  const dateKey = input.date ?? localDateKey(Date.now(), location[0].timezone);
  const responses = await db().select().from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, locationId), eq(structuredTaskResponses.dateKey, dateKey)));
  return { dateKey, tasks: [...checklists, ...cleaning, ...security].map(dto), responses: responses.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })) };
}

export async function updateLocalStructuredTask(context: AuthContext, input: Record<string, unknown>) {
  const area = input.area;
  if (typeof area !== "string" || !structuredAreas.includes(area as StructuredTaskArea)) throw new ApiError(422, "Task area is invalid");
  const parsedArea = area as StructuredTaskArea;
  const existing = await findActiveTask(parsedArea, input.taskId, id(input.locationId, "locationId"));
  const location = await locationFor(context, existing.locationId);
  if (existing.centralItemId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard tasks are controlled centrally");
  const type = taskTypeOf(input, existing);
  const completionMode = type === "with_steps" ? "question" : completionModeOf(input, existing);
  const steps = validateStructuredSteps(input.steps ?? existing.steps, type);
  const description = input.description === undefined ? existing.description : (input.description === null ? null : text(input.description, "Description"));
  const table = areaTable(parsedArea);
  const versionRootId = existing.versionRootId ?? existing.id;
  const at = new Date();
  return db().transaction(async tx => {
    await tx.update(table).set({ active: false, deactivatedAt: at } as never).where(eq(table.id, existing.id));
    const common = { active: true, versionRootId, order: existing.order, description, taskType: type, completionMode, steps };
    let row: unknown;
    if (parsedArea === "cleaning") {
      const current = existing as typeof cleaningTasks.$inferSelect;
      const name = text(input.name ?? input.title ?? current.name, "Name");
      const frequency = text(input.frequency ?? current.frequency, "Frequency");
      const weekdays = Array.isArray(input.weekdays) ? input.weekdays : (current.weekdays ?? []);
      row = await tx.insert(cleaningTasks).values({ locationId: location.id, name, frequency, weekdays, centralItemId: current.centralItemId, ...common } as never).returning();
    } else if (parsedArea === "opening" || parsedArea === "closing") {
      const current = existing as typeof checklistQuestions.$inferSelect;
      const question = text(input.question ?? input.title ?? current.question, "Question");
      row = await tx.insert(checklistQuestions).values({ locationId: location.id, checklist: current.checklist, question, centralItemId: current.centralItemId, ...common } as never).returning();
    } else {
      const current = existing as typeof securityQuestions.$inferSelect;
      const question = text(input.question ?? input.title ?? current.question, "Question");
      row = await tx.insert(securityQuestions).values({ locationId: location.id, session: current.session, question, centralItemId: current.centralItemId, ...common } as never).returning();
    }
    return (row as TaskRow[])[0] ? dto((row as TaskRow[])[0]) : null;
  });
}

export function validateStructuredTaskResponse(step: StructuredStepDefinition, value: unknown) {
  if (step.responseType === "confirm") {
    if (value !== true && value !== "confirmed" && value !== "yes") throw new ApiError(422, "Confirmation is required");
    return "confirmed";
  }
  if (step.responseType === "yes_no") {
    if (value !== "yes" && value !== "no") throw new ApiError(422, "Choose yes or no");
    return value;
  }
  if (step.responseType === "number") {
    if (typeof value === "string" && !value.trim()) throw new ApiError(422, "Enter a valid number");
    const number = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(number)) throw new ApiError(422, "Enter a valid number");
    return String(number);
  }
  const result = typeof value === "string" ? value.trim() : "";
  if (!result) throw new ApiError(422, "Enter a response");
  return result;
}

export async function saveStructuredTaskResponse(context: AuthContext, input: Record<string, unknown>) {
  const locationId = id(input.locationId, "locationId");
  const location = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location[0]) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, locationId, location[0].organisationId);
  const area = input.area;
  if (typeof area !== "string" || !structuredAreas.includes(area as StructuredTaskArea)) throw new ApiError(422, "Task area is invalid");
  const row = await findActiveTask(area as StructuredTaskArea, input.taskId, locationId);
  const steps = (row.steps ?? []) as StructuredStepDefinition[];
  const requestedStepId = typeof input.stepId === "string" ? input.stepId : "";
  const step = row.taskType === "with_steps" ? steps.find(item => item.id === requestedStepId) : { id: "simple", label: rowTitle(row), responseType: "confirm" as const };
  if (!step) throw new ApiError(404, "Task step not found");
  const value = validateStructuredTaskResponse(step, input.value);
  const memberId = id(input.teamMemberId, "teamMemberId");
  await activeMember(locationId, memberId);
  const dateKey = input.dateKey ? text(input.dateKey, "dateKey") : localDateKey(Date.now(), location[0].timezone);
  const problem = typeof input.problem === "string" ? input.problem.trim() : "";
  const action = typeof input.action === "string" ? input.action.trim() : "";
  return db().transaction(async tx => {
    const existing = await tx.select({ id: structuredTaskResponses.id }).from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, locationId), eq(structuredTaskResponses.taskArea, area), eq(structuredTaskResponses.taskId, row.id), eq(structuredTaskResponses.dateKey, dateKey), eq(structuredTaskResponses.stepId, step.id))).limit(1);
    if (existing.length) throw new ApiError(409, "This task step has already been completed");
    let issueId: string | undefined;
    if (step.responseType === "yes_no" && value === "no") {
      if (!problem || !action) throw new ApiError(422, "A problem and corrective action are required");
      const [issue] = await tx.insert(issues).values({ locationId, category: "Operational task", title: `${rowTitle(row)}: ${step.label}`, description: problem, status: "monitoring", createdBy: context.user.id, teamMemberId: memberId, action }).returning({ id: issues.id });
      issueId = issue?.id;
      if (issueId) await tx.insert(issueUpdates).values({ issueId, locationId, updateType: "immediate_action", note: action, status: "monitoring", createdBy: context.user.id, teamMemberId: memberId });
    }
    const [response] = await tx.insert(structuredTaskResponses).values({ locationId, taskArea: area, taskId: row.id, stepId: step.id, responseType: step.responseType, responseValue: value, dateKey, createdBy: context.user.id, teamMemberId: memberId }).returning();
    return { responseId: response.id, issueId, taskId: row.id, stepId: step.id };
  });
}

export async function signOffStructuredChecklist(context: AuthContext, input: Record<string, unknown>) {
  const area = input.area;
  if (!structuredAreas.includes(area as StructuredTaskArea) || area === "cleaning") throw new ApiError(422, "This task area does not support sign-off");
  const parsedArea = area as StructuredTaskArea;
  const locationId = id(input.locationId, "locationId");
  const location = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location[0]) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, locationId, location[0].organisationId);
  const dateKey = input.dateKey ? text(input.dateKey, "dateKey") : localDateKey(Date.now(), location[0].timezone);
  const memberId = id(input.teamMemberId, "teamMemberId");
  await activeMember(locationId, memberId);
  const { start, end } = localDayRange(Date.parse(`${dateKey}T12:00:00Z`), location[0].timezone);
  return db().transaction(async tx => {
    const tasks = area === "opening" || area === "closing"
      ? await tx.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, locationId), eq(checklistQuestions.checklist, parsedArea as "opening" | "closing"), eq(checklistQuestions.active, true)))
      : await tx.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, locationId), eq(securityQuestions.session, area === "security_am" ? "AM" : "PM"), eq(securityQuestions.active, true)));
    if (!tasks.length) throw new ApiError(422, "No active checklist tasks exist for this location");
    const legacyChecklist = area === "opening" || area === "closing"
      ? await tx.select({ questionId: checklistResponses.questionId }).from(checklistResponses).where(and(eq(checklistResponses.locationId, locationId), eq(checklistResponses.checklist, parsedArea as "opening" | "closing"), gte(checklistResponses.createdAt, new Date(start)), lt(checklistResponses.createdAt, new Date(end))))
      : [];
    const legacySecurity = area === "security_am" || area === "security_pm"
      ? await tx.select({ questionId: securityResponses.questionId }).from(securityResponses).where(and(eq(securityResponses.locationId, locationId), eq(securityResponses.session, area === "security_am" ? "AM" : "PM"), gte(securityResponses.createdAt, new Date(start)), lt(securityResponses.createdAt, new Date(end))))
      : [];
    const structured = await tx.select().from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, locationId), eq(structuredTaskResponses.taskArea, parsedArea), eq(structuredTaskResponses.dateKey, dateKey)));
    const complete = tasks.every(task => task.taskType === "with_steps"
      ? ((task.steps ?? []) as StructuredStepDefinition[]).filter(step => step.required !== false).every(step => structured.some(response => response.taskId === task.id && response.stepId === step.id))
      : task.completionMode === "task"
        ? structured.some(response => response.taskId === task.id && response.stepId === "simple")
        : structured.some(response => response.taskId === task.id && response.stepId === "simple") || (area === "opening" || area === "closing" ? legacyChecklist : legacySecurity).some(response => response.questionId === task.id));
    if (!complete) throw new ApiError(422, "Every active task must be completed before sign-off");
    const [signoff] = area === "opening" || area === "closing"
      ? await tx.insert(checklistSignOffs).values({ locationId, checklist: area, dateKey, completedAt: new Date(), completedBy: context.user.id, teamMemberId: memberId }).onConflictDoNothing({ target: [checklistSignOffs.locationId, checklistSignOffs.checklist, checklistSignOffs.dateKey] }).returning({ id: checklistSignOffs.id })
      : await tx.insert(securitySignOffs).values({ locationId, session: area === "security_am" ? "AM" : "PM", dateKey, completedAt: new Date(), completedBy: context.user.id, teamMemberId: memberId }).onConflictDoNothing({ target: [securitySignOffs.locationId, securitySignOffs.session, securitySignOffs.dateKey] }).returning({ id: securitySignOffs.id });
    return { signoffId: signoff?.id, existing: !signoff };
  });
}
