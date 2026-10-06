import { and, eq } from "drizzle-orm";
import { cleaningTasks } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id, locationFor, text } from "./shared.js";
import { validateStructuredSteps } from "../compliance/structured-task-service.js";

const taskType = (value: unknown) => value === undefined ? "simple" : value === "with_steps" ? "with_steps" : value === "simple" ? "simple" : (() => { throw new ApiError(422, "Task type is invalid"); })();
const description = (value: unknown) => value === undefined || value === null || value === "" ? null : text(value, "Description");

async function cleaningLocation(context: AuthContext, taskId: string) {
  const idValue = id(taskId, "taskId");
  const [row] = await db().select().from(cleaningTasks).where(eq(cleaningTasks.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Cleaning task not found");
  await locationFor(context, row.locationId);
  if (row.centralItemId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard cleaning tasks are controlled centrally");
  return row;
}

const cleaningFrequency = (value: unknown) => requireEnum(value, "frequency", ["after_use", "daily", "weekly", "specific_days"] as const);
const weekdays = (value: unknown): number[] => {
  if (!Array.isArray(value) || value.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new ApiError(400, "weekdays must contain values from 0 to 6");
  return value as number[];
};

export async function addCleaning(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const name = text(input.name, "Name");
  const frequency = cleaningFrequency(input.frequency);
  const days = weekdays(input.weekdays ?? []);
  const type = taskType(input.taskType);
  const steps = validateStructuredSteps(input.steps, type);
  const details = description(input.description);
  const rows = await db().select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id));
  const [row] = await db().insert(cleaningTasks).values({ locationId: location.id, name, description: details, taskType: type, steps, frequency, weekdays: days, order: rows.length, active: true }).returning();
  return row;
}

export async function updateCleaning(context: AuthContext, taskId: string, input: Record<string, unknown>) {
  const old = await cleaningLocation(context, taskId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  const name = text(input.name, "Name");
  const frequency = cleaningFrequency(input.frequency);
  const days = weekdays(input.weekdays ?? []);
  const type = taskType(input.taskType ?? old.taskType);
  const steps = validateStructuredSteps(input.steps ?? old.steps, type);
  const details = input.description === undefined ? old.description : description(input.description);
  return db().transaction(async tx => {
    const at = new Date();
    await tx.update(cleaningTasks).set({ active: false, deactivatedAt: at }).where(eq(cleaningTasks.id, old.id));
    const [row] = await tx.insert(cleaningTasks).values({ locationId: old.locationId, name, description: details, taskType: type, steps, frequency, weekdays: days, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id, centralItemId: old.centralItemId }).returning();
    return row;
  });
}

export async function deleteCleaning(context: AuthContext, taskId: string) {
  const old = await cleaningLocation(context, taskId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  await db().update(cleaningTasks).set({ active: false, deactivatedAt: new Date() }).where(eq(cleaningTasks.id, old.id));
  return { id: old.id, active: false };
}

export async function reorderCleaning(context: AuthContext, taskId: string, direction: unknown) {
  const old = await cleaningLocation(context, taskId);
  requireEnum(direction, "direction", ["up", "down"] as const);
  const rows = (await db().select().from(cleaningTasks).where(and(eq(cleaningTasks.locationId, old.locationId), eq(cleaningTasks.active, true)))).sort((a, b) => a.order - b.order);
  const i = rows.findIndex(row => row.id === old.id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || !rows[j]) return old;
  return db().transaction(async tx => {
    await tx.update(cleaningTasks).set({ order: rows[j].order }).where(eq(cleaningTasks.id, rows[i].id));
    await tx.update(cleaningTasks).set({ order: rows[i].order }).where(eq(cleaningTasks.id, rows[j].id));
    return rows[i];
  });
}
