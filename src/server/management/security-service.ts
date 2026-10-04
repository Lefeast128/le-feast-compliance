import { and, eq } from "drizzle-orm";
import { securityQuestions } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id, locationFor, text } from "./shared.js";

async function securityLocation(context: AuthContext, questionId: string) {
  const idValue = id(questionId, "questionId");
  const [row] = await db().select().from(securityQuestions).where(eq(securityQuestions.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Question not found");
  await locationFor(context, row.locationId);
  return row;
}

export async function addSecurity(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const session = requireEnum(input.session, "session", ["AM", "PM"] as const);
  const question = text(input.question, "Question");
  const rows = await db().select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, session)));
  const [row] = await db().insert(securityQuestions).values({ locationId: location.id, session, question, order: rows.length, active: true }).returning();
  return row;
}

export async function updateSecurity(context: AuthContext, questionId: string, input: Record<string, unknown>) {
  const old = await securityLocation(context, questionId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  const question = text(input.question, "Question");
  return db().transaction(async tx => {
    const at = new Date();
    await tx.update(securityQuestions).set({ active: false, deactivatedAt: at }).where(eq(securityQuestions.id, old.id));
    const [row] = await tx.insert(securityQuestions).values({ locationId: old.locationId, session: old.session, question, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning();
    return row;
  });
}

export async function deleteSecurity(context: AuthContext, questionId: string) {
  const old = await securityLocation(context, questionId);
  if (!old.active) throw new ApiError(409, "This configuration version is no longer active");
  await db().update(securityQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(securityQuestions.id, old.id));
  return { id: old.id, active: false };
}
