import { and, asc, eq, inArray } from "drizzle-orm";
import { buildManagerOverviewStoreSummary } from "../../lib/manager-overview.js";
import { buildManagerActionCentre } from "../../lib/manager-action-centre.js";
import { ApiError } from "../compliance/errors.js";
import { getDb } from "../db/client.js";
import { locations } from "../db/schema.js";
import { requireLocationManager, type AuthContext } from "../auth/core.js";
import { getDashboard } from "../dashboard/repository.js";
import { additionalDashboard } from "../additional/service.js";
import { getManagerReviews } from "./service.js";

type SummaryInput = Parameters<typeof buildManagerOverviewStoreSummary>[0];

const compat = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(compat);
  if (!value || typeof value !== "object") return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, compat(item)]));
  if (typeof result.id === "string" && result._id === undefined) result._id = result.id;
  return result;
};

export type ManagerOverviewLocationScope = { kind: "organisation"; organisationId: string } | { kind: "locations"; locationIds: string[] };

export function managerOverviewLocationScope(context: AuthContext): ManagerOverviewLocationScope {
  if (context.user.role === "admin") {
    if (!context.user.organisationId) throw new ApiError(403, "Manager access required");
    return { kind: "organisation", organisationId: context.user.organisationId };
  }

  const locationIds = [...new Set(context.memberships
    .filter(membership => membership.role === "manager")
    .map(membership => membership.locationId))];
  if (!locationIds.length || !context.user.organisationId) throw new ApiError(403, "Manager access required");
  return { kind: "locations", locationIds };
}

export async function summarizeStoresIndependently<T extends { id: string; name: string; timezone: string }>(
  stores: T[],
  summarize: (store: T) => Promise<{ checksOutstanding: number; unresolvedIssues: number; cleaningOutstanding: number; reviewsDue: number; dueLater: number }>,
) {
  return Promise.all(stores.map(async location => {
    try {
      const summary = await summarize(location);
      return { location: { id: location.id, name: location.name, timezone: location.timezone }, state: "ready" as const, updatedAt: new Date().toISOString(), summary };
    } catch {
      return { location: { id: location.id, name: location.name, timezone: location.timezone }, state: "error" as const, updatedAt: null, summary: null };
    }
  }));
}

export async function getAllStoreManagerOverview(context: AuthContext) {
  const scope = managerOverviewLocationScope(context);
  const filters = [eq(locations.active, true)];
  if (scope.kind === "organisation") filters.push(eq(locations.organisationId, scope.organisationId));
  else {
    filters.push(inArray(locations.id, scope.locationIds));
    filters.push(eq(locations.organisationId, context.user.organisationId!));
  }
  const stores = await getDb().select({ id: locations.id, organisationId: locations.organisationId, name: locations.name, timezone: locations.timezone })
    .from(locations).where(and(...filters)).orderBy(asc(locations.name));

  const summaries = await summarizeStoresIndependently(stores, async location => {
      requireLocationManager(context, location.id, location.organisationId);
      const now = Date.now();
      const [dashboard, additional, reviews] = await Promise.all([
        getDashboard(context, location.id, now),
        additionalDashboard(context, location.id, now),
        getManagerReviews(context, location.id, now),
      ]);
      const dashboardData = compat(dashboard) as Parameters<typeof buildManagerActionCentre>[0];
      const additionalData = compat(additional) as typeof additional & {
        requirements: SummaryInput["additionalRequirements"];
        completions: SummaryInput["additionalCompletions"];
      };
      const centre = buildManagerActionCentre({
        ...dashboardData,
        additionalRequirements: additionalData.requirements,
        additionalCompletions: additionalData.completions,
      }, now);
      const summary = buildManagerOverviewStoreSummary({
        now,
        issues: reviews.currentIssues,
        centre,
        cleaningTasks: dashboardData.structuredTasks.filter(task => task.area === "cleaning"),
        additionalRequirements: additionalData.requirements,
        additionalCompletions: additionalData.completions,
        timezone: location.timezone,
        weekly: reviews.periods.weekly,
        fourWeekly: reviews.periods.four_weekly,
      });
      return summary;
  });

  return { generatedAt: new Date().toISOString(), stores: summaries };
}
