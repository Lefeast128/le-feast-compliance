import { asc, eq } from "drizzle-orm";
import { teamMembers } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id, locationFor, member, text } from "./shared.js";

export async function listTeamMembers(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId);
  return db().select().from(teamMembers).where(eq(teamMembers.locationId, location.id)).orderBy(asc(teamMembers.name));
}

export async function addTeamMember(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, id(input.locationId, "locationId"));
  const name = text(input.name, "Name");
  const role = requireEnum(input.role ?? "team", "role", ["team", "manager"] as const);
  const [created] = await db().insert(teamMembers).values({ locationId: location.id, name, role, active: true }).returning();
  return created;
}

export async function updateTeamMember(context: AuthContext, memberId: string, input: Record<string, unknown>) {
  const current = await member(memberId);
  await locationFor(context, current.locationId);
  const patch: { name?: string; role?: "team" | "manager"; active?: boolean } = {};
  if (input.name !== undefined) patch.name = text(input.name, "Name");
  if (input.role !== undefined) patch.role = requireEnum(input.role, "role", ["team", "manager"] as const);
  if (input.active !== undefined) {
    if (typeof input.active !== "boolean") throw new ApiError(400, "active must be boolean");
    patch.active = input.active;
  }
  if (!Object.keys(patch).length) throw new ApiError(400, "No changes supplied");
  const [updated] = await db().update(teamMembers).set(patch).where(eq(teamMembers.id, current.id)).returning();
  return updated;
}

export async function deleteTeamMember(context: AuthContext, memberId: string) {
  const current = await member(memberId);
  await locationFor(context, current.locationId);
  const [updated] = await db().update(teamMembers).set({ active: false }).where(eq(teamMembers.id, current.id)).returning();
  return updated;
}
