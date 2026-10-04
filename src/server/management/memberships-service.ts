import { and, eq } from "drizzle-orm";
import { locations, memberships, users } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { requireOrganisationAdmin } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum } from "../compliance/validation.js";
import { db, id } from "./shared.js";

export async function addMembership(context: AuthContext, input: Record<string, unknown>) {
  const locationId = id(input.locationId, "locationId");
  const userId = id(input.userId, "userId");
  const [location] = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireOrganisationAdmin(context, location.organisationId);
  const role = requireEnum(input.role, "role", ["staff", "manager"] as const);
  const [user] = await db().select().from(users).where(and(eq(users.id, userId), eq(users.organisationId, location.organisationId))).limit(1);
  if (!user) throw new ApiError(404, "User not found");
  const [row] = await db().insert(memberships).values({ userId: user.id, locationId: location.id, role }).onConflictDoUpdate({ target: [memberships.userId, memberships.locationId], set: { role } }).returning();
  return row;
}

export async function removeMembership(context: AuthContext, membershipId: string) {
  const idValue = id(membershipId, "membershipId");
  const [row] = await db().select().from(memberships).where(eq(memberships.id, idValue)).limit(1);
  if (!row) throw new ApiError(404, "Membership not found");
  const [location] = await db().select().from(locations).where(eq(locations.id, row.locationId)).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireOrganisationAdmin(context, location.organisationId);
  await db().delete(memberships).where(eq(memberships.id, row.id));
  return { id: row.id, removed: true };
}
