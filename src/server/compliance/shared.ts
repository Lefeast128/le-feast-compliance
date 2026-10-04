import { and, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { issues, locations, teamMembers } from "../db/schema.js";
import { requireLocationAccess, type AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { requireUuid } from "./validation.js";

export const now = () => new Date();

export async function locationFor(context: AuthContext, locationId: string, active = true) {
  requireUuid(locationId, "locationId");
  const db = getDb();
  const rows = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  const location = rows[0];
  if (!location || (active && !location.active)) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, location.id, location.organisationId);
  return location;
}
export async function activeMember(locationId: string, memberId: string) {
  requireUuid(memberId, "teamMemberId");
  const db = getDb();
  const rows = await db.select().from(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.locationId, locationId))).limit(1);
  const member = rows[0];
  if (!member) throw new ApiError(422, "Team member does not belong to this location");
  if (!member.active) throw new ApiError(422, "Team member is inactive");
  return member;
}

export async function issueAndMember(context: AuthContext, issueId: string, memberId: string, category: string) {
  requireUuid(issueId, "issueId");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  if (issue.category !== category) throw new ApiError(422, `Issue is not a ${category.toLowerCase()} issue`);
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, memberId);
  if (issue.status === "resolved") throw new ApiError(409, `${category} issue is already resolved`);
  return { db, issue, location };
}
