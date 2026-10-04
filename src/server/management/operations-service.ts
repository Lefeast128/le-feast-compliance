import { and, eq } from "drizzle-orm";
import { checklistQuestions, cleaningTasks, equipment, issues, locations, memberships, probeProducts, scheduledTasks, securityQuestions, teamMembers, wastageItems } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { db } from "./shared.js";

type LocationRow = typeof locations.$inferSelect;

export async function operations(context: AuthContext) {
  const orgId = context.user.organisationId;
  if (!orgId) throw new ApiError(403, "Access denied");
  const allowed = context.user.role === "admin"
    ? await db().select().from(locations).where(and(eq(locations.organisationId, orgId), eq(locations.active, true)))
    : await db().select({ location: locations }).from(locations).innerJoin(memberships, eq(memberships.locationId, locations.id)).where(and(eq(memberships.userId, context.user.id), eq(memberships.role, "manager"), eq(locations.active, true)));
  const seen = new Map<string, LocationRow>();
  for (const row of allowed) {
    const location = "location" in row ? row.location : row;
    if (!seen.has(location.id)) seen.set(location.id, location);
  }
  const result = [];
  for (const location of seen.values()) {
    const [taskRows, issueRows] = await Promise.all([
      db().select().from(scheduledTasks).where(eq(scheduledTasks.locationId, location.id)),
      db().select().from(issues).where(eq(issues.locationId, location.id)),
    ]);
    result.push({
      location,
      teamMembers: await db().select().from(teamMembers).where(eq(teamMembers.locationId, location.id)),
      equipment: await db().select().from(equipment).where(and(eq(equipment.locationId, location.id), eq(equipment.active, true))),
      probeProducts: (await db().select().from(probeProducts)).filter(product => product.active && (product.locationIds ?? []).includes(location.id)),
      checklistQuestions: await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.active, true))),
      securityQuestions: await db().select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.active, true))),
      cleaningTasks: await db().select().from(cleaningTasks).where(and(eq(cleaningTasks.locationId, location.id), eq(cleaningTasks.active, true))),
      wastageItems: await db().select().from(wastageItems).where(and(eq(wastageItems.locationId, location.id), eq(wastageItems.active, true))),
      scheduledTasks: taskRows,
      issues: issueRows.filter(issue => issue.status !== "resolved"),
      total: taskRows.length + 3,
      complete: taskRows.filter(task => task.status === "complete").length,
    });
  }
  return result;
}
