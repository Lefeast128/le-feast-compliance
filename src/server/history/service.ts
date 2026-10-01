/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { checklistResponses, checklistSignOffs, cleaningCompletions, foodChecks, issueUpdates as issueUpdatesTable, issues, locations, rechecks as rechecksTable, securityResponses, securitySignOffs, temperatureReadings, temperatureRounds, wastageRecords } from "../db/schema.js";
import { requireLocationAccess, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { localDateKey, localDayRange } from "../compliance/validation.js";

function dateValue(value: unknown, label: string) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(400, `${label} must be YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00Z`); if (Number.isNaN(date.getTime())) throw new ApiError(400, `${label} is invalid`); return value;
}
function dayBounds(start: string, end: string) {
  const from = dateValue(start, "start"); const to = dateValue(end, "end"); if (from > to) throw new ApiError(400, "Date range is invalid");
  const days: string[] = []; const date = new Date(`${from}T00:00:00Z`); const finish = new Date(`${to}T00:00:00Z`); while (date <= finish) { days.push(date.toISOString().slice(0, 10)); date.setUTCDate(date.getUTCDate() + 1); if (days.length > 366) throw new ApiError(400, "Date range is too large"); } return { from, to, days };
}
async function locationFor(context: AuthContext, locationId: string) {
  const [location] = await getDb().select().from(locations).where(eq(locations.id, locationId)).limit(1); if (!location || !location.active) throw new ApiError(404, "Location not found"); requireLocationAccess(context, location.id, location.organisationId); return location;
}
const iso = (row: any) => row && { ...row, createdAt: row.createdAt?.toISOString?.() ?? row.createdAt, startedAt: row.startedAt?.toISOString?.() ?? row.startedAt, completedAt: row.completedAt?.toISOString?.() ?? row.completedAt, resolvedAt: row.resolvedAt?.toISOString?.() ?? row.resolvedAt };

export async function calendar(context: AuthContext, input: { locationId: string; monthStart: string; monthEnd: string }) {
  const location = await locationFor(context, input.locationId); const { from, to, days } = dayBounds(input.monthStart, input.monthEnd); const db = getDb(); const start = new Date(localDayRange(Date.parse(`${from}T12:00:00Z`), location.timezone).start); const end = new Date(localDayRange(Date.parse(`${to}T12:00:00Z`), location.timezone).end - 1);
  const [rounds, readings, probes, issuesRows, checklist, security, cleaning, wastage] = await Promise.all([
    db.select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), gte(temperatureRounds.startedAt, start), lte(temperatureRounds.startedAt, end))),
    db.select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, location.id), gte(temperatureReadings.createdAt, start), lte(temperatureReadings.createdAt, end))),
    db.select().from(issues).where(and(eq(issues.locationId, location.id), lte(issues.createdAt, end))),
    db.select().from(foodChecks).where(and(eq(foodChecks.locationId, location.id), gte(foodChecks.createdAt, start), lte(foodChecks.createdAt, end))),
    db.select().from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), gte(checklistResponses.createdAt, start), lte(checklistResponses.createdAt, end))),
    db.select().from(securityResponses).where(and(eq(securityResponses.locationId, location.id), gte(securityResponses.createdAt, start), lte(securityResponses.createdAt, end))),
    db.select().from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), gte(cleaningCompletions.completedAt, start), lte(cleaningCompletions.completedAt, end))),
    db.select().from(wastageRecords).where(and(eq(wastageRecords.locationId, location.id), gte(wastageRecords.createdAt, start), lte(wastageRecords.createdAt, end))),
  ]);
  const result = days.map(date => {
    const dayRounds = rounds.filter(r => localDateKey(r.startedAt.getTime(), location.timezone) === date); const dayReadings = readings.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date); const dayProbes = probes.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date); const dayIssues = issuesRows.filter((r: any) => localDateKey(r.createdAt.getTime(), location.timezone) <= date && (r.resolvedAt ? localDateKey(r.resolvedAt.getTime(), location.timezone) >= date : r.status !== "resolved")); const failed = dayIssues.length > 0 || dayReadings.some(r => r.result === "fail") || dayProbes.some(r => r.result === "fail"); return { date, status: failed ? "red" : "green", readings: dayReadings.length, probes: dayProbes.length, issues: dayIssues.length, rounds: dayRounds.length, checklistResponses: checklist.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date).length, securityResponses: security.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date).length, cleaningCompletions: cleaning.filter(r => r.dateKey === date).length, wastageRecords: wastage.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date).length }; });
  return { location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone }, days: result };
}

export async function archive(context: AuthContext, input: { locationId: string; start: string; end: string }) {
  const location = await locationFor(context, input.locationId); const { from, to } = dayBounds(input.start, input.end); const start = new Date(localDayRange(Date.parse(`${from}T12:00:00Z`), location.timezone).start); const end = new Date(localDayRange(Date.parse(`${to}T12:00:00Z`), location.timezone).end - 1); const db = getDb();
  const [readings, rounds, probes, questions, checklistSignoffs, securityResponsesRows, securitySignoffs, wastage, cleaning, issuesRows, updates, recheckRows] = await Promise.all([
    db.select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, location.id), gte(temperatureReadings.createdAt, start), lte(temperatureReadings.createdAt, end))),
    db.select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), gte(temperatureRounds.startedAt, start), lte(temperatureRounds.startedAt, end))),
    db.select().from(foodChecks).where(and(eq(foodChecks.locationId, location.id), gte(foodChecks.createdAt, start), lte(foodChecks.createdAt, end))),
    db.select().from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), gte(checklistResponses.createdAt, start), lte(checklistResponses.createdAt, end))),
    db.select().from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), gte(checklistSignOffs.completedAt, start), lte(checklistSignOffs.completedAt, end))),
    db.select().from(securityResponses).where(and(eq(securityResponses.locationId, location.id), gte(securityResponses.createdAt, start), lte(securityResponses.createdAt, end))),
    db.select().from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), gte(securitySignOffs.completedAt, start), lte(securitySignOffs.completedAt, end))),
    db.select().from(wastageRecords).where(and(eq(wastageRecords.locationId, location.id), gte(wastageRecords.createdAt, start), lte(wastageRecords.createdAt, end))),
    db.select().from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), gte(cleaningCompletions.completedAt, start), lte(cleaningCompletions.completedAt, end))),
    db.select().from(issues).where(and(eq(issues.locationId, location.id), lte(issues.createdAt, end))),
    db.select().from(issueUpdatesTable).where(and(eq(issueUpdatesTable.locationId, location.id), gte(issueUpdatesTable.createdAt, start), lte(issueUpdatesTable.createdAt, end))),
    db.select().from(rechecksTable).where(and(eq(rechecksTable.locationId, location.id), gte(rechecksTable.createdAt, start), lte(rechecksTable.createdAt, end))),
  ]);
  const issueIds = new Set(issuesRows.map(i => i.id)); const issueUpdates = updates.filter(u => issueIds.has(u.issueId)); const rechecks = recheckRows.filter(r => issueIds.has(r.issueId));
  return { location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone }, readings: readings.map(iso), rounds: rounds.map(iso), probes: probes.map(iso), questions: { opening: questions.filter(q => q.checklist === "opening").map(iso), closing: questions.filter(q => q.checklist === "closing").map(iso) }, checklistSignOffs: checklistSignoffs.map(iso), securityResponses: { AM: securityResponsesRows.filter(r => r.session === "AM").map(iso), PM: securityResponsesRows.filter(r => r.session === "PM").map(iso) }, securitySignOffs: securitySignoffs.map(iso), wastageRecords: wastage.map(iso), cleaningCompletions: cleaning.map(iso), issues: issuesRows.map(iso), issueUpdates: issueUpdates.map(iso), rechecks: rechecks.map(iso) };
}
