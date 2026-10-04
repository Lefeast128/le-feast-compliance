import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, locations, teamMembers } from "../db/schema.js";
import { requireLocationManager, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireFiniteNumber, requireString, requireUuid } from "../compliance/validation.js";

export type Db = ReturnType<typeof getDb>;
export type Transaction = Parameters<Db["transaction"]>[0] extends (tx: infer T, ...args: never[]) => unknown ? T : never;

export const db = () => getDb();
export const id = (value: unknown, label: string): string => requireUuid(value, label);
export const text = (value: unknown, label: string): string => requireString(value, label);
export const finite = (value: unknown, label: string): number => requireFiniteNumber(value, label) as number;

export async function locationFor(context: AuthContext, locationId: string) {
  id(locationId, "locationId");
  const [location] = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  return location;
}

export async function member(memberId: string) {
  id(memberId, "memberId");
  const [row] = await db().select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
  if (!row) throw new ApiError(404, "Team member not found");
  return row;
}

export async function audit(tx: Transaction, locationId: string | null, userId: string, type: string, detail: string) {
  await tx.insert(auditEvents).values({ locationId, userId, type, detail, createdAt: new Date() });
}
