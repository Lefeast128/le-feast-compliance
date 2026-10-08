import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { cleaningCompletions, cleaningTasks } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, locationFor, now } from "./shared.js";
import { localDateKey, requireUuid } from "./validation.js";

export async function completeCleaning(context: AuthContext, input: { locationId: string; taskId: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  const db = getDb();
  requireUuid(input.taskId, "taskId");
  const [task] = await db.select().from(cleaningTasks).where(and(eq(cleaningTasks.id, input.taskId), eq(cleaningTasks.locationId, location.id))).limit(1);
  if (!task) throw new ApiError(422, "Cleaning task does not belong to this location");
  if (!task.active) throw new ApiError(422, "This configuration version is no longer active");
  if (task.completionMode === "question") throw new ApiError(422, "Yes/No cleaning questions must use the structured task workflow");
  const dateKey = localDateKey(Date.now(), location.timezone);
  const existing = await db.select({ id: cleaningCompletions.id }).from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), eq(cleaningCompletions.taskId, task.id), eq(cleaningCompletions.dateKey, dateKey))).limit(1);
  if (existing[0]) return { completionId: existing[0].id, existing: true };
  const [completion] = await db.insert(cleaningCompletions).values({ locationId: location.id, taskId: task.id, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [cleaningCompletions.locationId, cleaningCompletions.taskId, cleaningCompletions.dateKey] }).returning({ id: cleaningCompletions.id });
  if (!completion) {
    const [existingCompletion] = await db.select({ id: cleaningCompletions.id }).from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), eq(cleaningCompletions.taskId, task.id), eq(cleaningCompletions.dateKey, dateKey))).limit(1);
    return { completionId: existingCompletion.id, existing: true };
  }
  return { completionId: completion.id, existing: false };
}
