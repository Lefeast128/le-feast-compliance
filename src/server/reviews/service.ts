import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { requireLocationManager, type AuthContext } from "../auth/core.js";
import { getDb } from "../db/client.js";
import { auditEvents, foodChecks, issueUpdates, issues, locations, managerReviews, rechecks, teamMembers, temperatureReadings, users } from "../db/schema.js";
import { ApiError } from "../compliance/errors.js";
import { localDateKey, localDayRange, requireBoolean, requireEnum, requireString, requireUuid } from "../compliance/validation.js";

export const FSA_REVIEW_QUESTIONS = [
  "Have you reviewed your safe methods?",
  "Has allergen information been updated to reflect any menu or ingredient changes?",
  "Have you changed any equipment or processes which change your safe methods?",
  "Have any new suppliers been recorded with contact information?",
  "Does the cleaning schedule require updating?",
  "Have new staff, if applicable, been trained in all safe methods?",
  "Do any existing staff require safe method refresher training?",
  "Are any extra opening or closing checks required?",
  "If any food complaints have been received, have they been investigated and safe methods reviewed?",
  "Have probes been calibrated in the last 4 weeks and results recorded?",
  "Have extra checks been completed and recorded weekly?",
  "Are prove-it checks being completed regularly and recorded?",
] as const;

export type ReviewType = "weekly" | "four_weekly";
export type ReviewPeriod = { reviewType: ReviewType; start: string; end: string };
export type ReviewStatus = "complete" | "due" | "overdue" | "up_to_date";
export type ReviewPeriodState = { reviewType: ReviewType; start: string | null; end: string | null; status: ReviewStatus; daysUntilDue: number; available: boolean; nextAvailableAfter: string | null };

type IssueRow = typeof issues.$inferSelect;
type IssueUpdateRow = typeof issueUpdates.$inferSelect;
type RecheckRow = typeof rechecks.$inferSelect;

const db = () => getDb();
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

const dateKeyAtOffset = (dateKey: string, offset: number) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const periodStart = (today: string, timeZone: string) => {
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(`${today}T12:00:00Z`));
  const mondayOffset = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  return dateKeyAtOffset(today, -mondayOffset);
};

export const completedReviewPeriod = (timeZone: string, reviewType: ReviewType, timestamp = Date.now()): ReviewPeriod => {
  const today = localDateKey(timestamp, timeZone);
  const currentWeek = periodStart(today, timeZone);
  const end = dateKeyAtOffset(currentWeek, -1);
  const start = reviewType === "weekly" ? dateKeyAtOffset(currentWeek, -7) : dateKeyAtOffset(currentWeek, -28);
  return { reviewType, start, end };
};

export const nextOutstandingReviewPeriod = (completedRows: Array<Pick<typeof managerReviews.$inferSelect, "periodStart" | "periodEnd">>, timeZone: string, reviewType: ReviewType, timestamp = Date.now()): ReviewPeriod | null => {
  const latestEligible = completedReviewPeriod(timeZone, reviewType, timestamp);
  if (!completedRows.length) return latestEligible;
  const periodLength = reviewType === "weekly" ? 7 : 28;
  const completed = new Set(completedRows.map(row => `${row.periodStart}:${row.periodEnd}`));
  const first = [...completedRows].sort((a, b) => a.periodStart.localeCompare(b.periodStart))[0];
  let candidate: ReviewPeriod = { reviewType, start: first.periodStart, end: first.periodEnd };
  while (candidate.end <= latestEligible.end) {
    if (!completed.has(`${candidate.start}:${candidate.end}`)) return candidate;
    const start = dateKeyAtOffset(candidate.end, 1);
    candidate = { reviewType, start, end: dateKeyAtOffset(start, periodLength - 1) };
  }
  return null;
};

export const reviewPeriodState = (period: ReviewPeriod | null, timeZone: string, completed: boolean, timestamp = Date.now(), reviewType: ReviewType = period?.reviewType ?? "weekly"): ReviewPeriodState => {
  if (!period) {
    const latestEligible = completedReviewPeriod(timeZone, reviewType, timestamp);
    return { reviewType, start: null, end: null, status: "up_to_date", daysUntilDue: 0, available: false, nextAvailableAfter: dateKeyAtOffset(latestEligible.end, reviewType === "weekly" ? 7 : 28) };
  }
  if (completed) return { ...period, status: "complete", daysUntilDue: 0, available: true, nextAvailableAfter: null };
  const today = localDateKey(timestamp, timeZone);
  const daysUntilDue = Math.round((Date.parse(`${period.end}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000);
  return { ...period, status: daysUntilDue < 0 ? "overdue" : "due", daysUntilDue, available: true, nextAvailableAfter: null };
};

const periodBounds = (period: ReviewPeriod, timeZone: string) => ({
  start: new Date(localDayRange(Date.parse(`${period.start}T12:00:00Z`), timeZone).start),
  end: new Date(localDayRange(Date.parse(`${period.end}T12:00:00Z`), timeZone).end - 1),
});

const jsonRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const statusAt = (issue: IssueRow, updates: IssueUpdateRow[], end: Date) => {
  const relevant = updates.filter(update => update.createdAt <= end).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (issue.resolvedAt && issue.resolvedAt <= end) return "resolved";
  return relevant[relevant.length - 1]?.status ?? (issue.status === "resolved" ? "open" : issue.status);
};

const issueIdentity = (issue: IssueRow, readings: Array<typeof temperatureReadings.$inferSelect>, probes: Array<typeof foodChecks.$inferSelect>) => {
  const reading = readings.find(row => row.id === issue.sourceTemperatureReadingId);
  if (reading) return { key: `temperature:${reading.equipmentId}`, label: `Temperature · ${reading.equipmentName ?? "Fridge"}` };
  const probe = probes.find(row => row.id === issue.sourceFoodCheckId);
  if (probe) return { key: `probe:${probe.probeProductId ?? probe.product.toLowerCase()}`, label: `Probe · ${probe.product}` };
  if (issue.title.includes("checklist:")) return { key: `checklist:${issue.title.toLowerCase()}`, label: issue.title };
  return { key: `issue:${issue.category.toLowerCase()}:${issue.title.toLowerCase()}`, label: issue.title };
};

const summaryFor = (issuesInPeriod: IssueRow[], updates: IssueUpdateRow[], rechecks: RecheckRow[], readings: Array<typeof temperatureReadings.$inferSelect>, probes: Array<typeof foodChecks.$inferSelect>, start: Date, end: Date) => {
  const raisedIssues = issuesInPeriod.filter(issue => issue.createdAt >= start && issue.createdAt <= end);
  const groups = new Map<string, { key: string; label: string; count: number }>();
  for (const issue of raisedIssues) {
    const identity = issueIdentity(issue, readings, probes);
    const existing = groups.get(identity.key);
    if (existing) existing.count += 1;
    else groups.set(identity.key, { ...identity, count: 1 });
  }
  const resolved = issuesInPeriod.filter(issue => issue.resolvedAt && issue.resolvedAt >= start && issue.resolvedAt <= end).length;
  const outstanding = issuesInPeriod.filter(issue => statusAt(issue, updates.filter(update => update.issueId === issue.id), end) !== "resolved").length;
  const periodUpdates = updates.filter(update => update.createdAt >= start && update.createdAt <= end);
  const correctiveActions = periodUpdates.filter(update => update.updateType === "immediate_action" || update.updateType === "further_action" || update.updateType === "manager_review").length;
  const resolutionActivity = periodUpdates.filter(update => update.updateType === "resolution" || update.status === "resolved").length;
  return {
    issuesRaised: raisedIssues.length,
    issuesResolved: resolved,
    outstandingIssues: outstanding,
    openIssues: issuesInPeriod.filter(issue => statusAt(issue, updates.filter(update => update.issueId === issue.id), end) === "open").length,
    monitoringIssues: issuesInPeriod.filter(issue => statusAt(issue, updates.filter(update => update.issueId === issue.id), end) === "monitoring").length,
    correctiveActions,
    rechecks: rechecks.filter(recheck => recheck.createdAt >= start && recheck.createdAt <= end).length,
    resolutionActivity,
    failedTemperatureChecks: new Set(raisedIssues.filter(issue => issue.category === "Temperature").map(issue => issue.sourceTemperatureReadingId).filter(Boolean)).size,
    failedProbeChecks: new Set(raisedIssues.filter(issue => issue.category === "Probe").map(issue => issue.sourceFoodCheckId).filter(Boolean)).size,
    otherIssues: raisedIssues.filter(issue => issue.category !== "Temperature" && issue.category !== "Probe").length,
    repeatProblems: [...groups.values()].filter(group => group.count >= 3).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  };
};

async function managedLocation(context: AuthContext, locationId: string) {
  requireUuid(locationId, "locationId");
  const [location] = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  return location;
}

async function rowsForPeriod(locationId: string, period: ReviewPeriod, timeZone: string) {
  const { start, end } = periodBounds(period, timeZone);
  const [issueRows, updateRows, recheckRows, readingRows, probeRows] = await Promise.all([
    db().select().from(issues).where(and(eq(issues.locationId, locationId), lte(issues.createdAt, end))),
    db().select().from(issueUpdates).where(and(eq(issueUpdates.locationId, locationId), lte(issueUpdates.createdAt, end))).orderBy(asc(issueUpdates.createdAt)),
    db().select().from(rechecks).where(and(eq(rechecks.locationId, locationId), gte(rechecks.createdAt, start), lte(rechecks.createdAt, end))),
    db().select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, locationId), gte(temperatureReadings.createdAt, start), lte(temperatureReadings.createdAt, end))),
    db().select().from(foodChecks).where(and(eq(foodChecks.locationId, locationId), gte(foodChecks.createdAt, start), lte(foodChecks.createdAt, end))),
  ]);
  return { issueRows, updateRows, recheckRows, readingRows, probeRows, start, end };
}

const emptyPeriodRows = () => ({ issueRows: [] as IssueRow[], updateRows: [] as IssueUpdateRow[], recheckRows: [] as RecheckRow[], readingRows: [] as Array<typeof temperatureReadings.$inferSelect>, probeRows: [] as Array<typeof foodChecks.$inferSelect>, start: new Date(0), end: new Date(0) });

async function issuePresentation(locationId: string, issueRows: IssueRow[], updateRows: IssueUpdateRow[], recheckRows: RecheckRow[], readingRows: Array<typeof temperatureReadings.$inferSelect>, probeRows: Array<typeof foodChecks.$inferSelect>, end: Date) {
  const ids = [...new Set(issueRows.flatMap(issue => [issue.createdBy, issue.resolvedBy]).filter((id): id is string => Boolean(id)).concat(updateRows.map(update => update.createdBy), recheckRows.map(recheck => recheck.createdBy)))];
  const userRows = ids.length ? await db().select().from(users).where(inArray(users.id, ids)) : [];
  const names = new Map(userRows.map(user => [user.id, user.name ?? user.email]));
  const memberRows = await db().select().from(teamMembers).where(eq(teamMembers.locationId, locationId));
  const memberNames = new Map(memberRows.map(member => [member.id, member.name]));
  return issueRows.map(issue => {
    const updates = updateRows.filter(update => update.issueId === issue.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const rechecks = recheckRows.filter(recheck => recheck.issueId === issue.id).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const reading = readingRows.find(row => row.id === issue.sourceTemperatureReadingId);
    const probe = probeRows.find(row => row.id === issue.sourceFoodCheckId);
    const status = statusAt(issue, updates, end);
    const journey = [
      reading ? { eventType: "original_failure", occurredAt: iso(reading.createdAt), title: "Original failed reading", detail: `${reading.equipmentName ?? "Fridge"} · ${reading.temperature}°C`, result: "fail", teamMemberName: memberNames.get(reading.teamMemberId ?? "") ?? null } : null,
      probe ? { eventType: "original_failure", occurredAt: iso(probe.createdAt), title: "Original failed probe", detail: `${probe.product} · ${probe.temperature}°C`, result: "fail", teamMemberName: memberNames.get(probe.teamMemberId ?? "") ?? null } : null,
      { eventType: "issue_created", occurredAt: iso(issue.createdAt), title: "Issue created", detail: issue.description, result: "open", teamMemberName: memberNames.get(issue.teamMemberId ?? "") ?? null },
      ...updates.map(update => ({ eventType: update.updateType, occurredAt: iso(update.createdAt), title: update.updateType === "resolution" ? "Resolution" : update.updateType === "manager_review" ? "Manager review" : "Corrective action", detail: update.note, result: update.status, teamMemberName: memberNames.get(update.teamMemberId ?? "") ?? names.get(update.createdBy) ?? null })),
      ...rechecks.map(recheck => ({ eventType: "recheck", occurredAt: iso(recheck.createdAt), title: "Recheck", detail: `${recheck.temperature}°C`, result: recheck.result, teamMemberName: memberNames.get(recheck.teamMemberId ?? "") ?? names.get(recheck.createdBy) ?? null })),
      issue.resolvedAt && issue.resolvedAt <= end ? { eventType: "issue_resolved", occurredAt: iso(issue.resolvedAt), title: "Issue resolved", detail: issue.resolutionNote ?? "Issue resolved", result: "resolved", teamMemberName: names.get(issue.resolvedBy ?? "") ?? null } : null,
    ].filter(Boolean);
    return {
      id: issue.id,
      title: issue.title,
      category: issue.category,
      description: issue.description,
      originalReading: issue.originalReading,
      action: issue.action,
      createdAt: iso(issue.createdAt),
      createdByName: names.get(issue.createdBy) ?? "Not recorded",
      teamMemberName: memberNames.get(issue.teamMemberId ?? "") ?? null,
      status,
      resolvedAt: issue.resolvedAt && issue.resolvedAt <= end ? iso(issue.resolvedAt) : null,
      resolvedByName: names.get(issue.resolvedBy ?? "") ?? null,
      latestAction: updates.filter(update => update.updateType !== "resolution")[updates.filter(update => update.updateType !== "resolution").length - 1]?.note ?? issue.action ?? null,
      latestRecheck: rechecks.length ? { temperature: rechecks[rechecks.length - 1].temperature, result: rechecks[rechecks.length - 1].result, occurredAt: iso(rechecks[rechecks.length - 1].createdAt) } : null,
      recheckCount: rechecks.length,
      journey,
    };
  });
}

async function existingReview(locationId: string, period: ReviewPeriod | null) {
  if (!period) return null;
  const [row] = await db().select().from(managerReviews).where(and(eq(managerReviews.locationId, locationId), eq(managerReviews.reviewType, period.reviewType), eq(managerReviews.periodStart, period.start))).limit(1);
  return row ?? null;
}

const reviewDto = (row: typeof managerReviews.$inferSelect, completedByName: string | null) => ({
  id: row.id,
  reviewType: row.reviewType,
  periodStart: row.periodStart,
  periodEnd: row.periodEnd,
  completedAt: row.completedAt.toISOString(),
  completedBy: completedByName ?? "Not recorded",
  summary: row.summary,
  seriousProblems: row.seriousProblems,
  details: row.details,
  actionTaken: row.actionTaken,
  answers: row.answers,
});

export async function getManagerReviews(context: AuthContext, locationId: string) {
  const location = await managedLocation(context, locationId);
  const [historyRows, historyUsers, currentIssues, locationMembers] = await Promise.all([
    db().select().from(managerReviews).where(eq(managerReviews.locationId, location.id)).orderBy(asc(managerReviews.periodStart)),
    db().select().from(users).where(eq(users.organisationId, location.organisationId)),
    db().select().from(issues).where(eq(issues.locationId, location.id)),
    db().select({ id: teamMembers.id, name: teamMembers.name }).from(teamMembers).where(eq(teamMembers.locationId, location.id)),
  ]);
  const weekly = nextOutstandingReviewPeriod(historyRows.filter(row => row.reviewType === "weekly"), location.timezone, "weekly");
  const fourWeekly = nextOutstandingReviewPeriod(historyRows.filter(row => row.reviewType === "four_weekly"), location.timezone, "four_weekly");
  const [weeklyRows, fourRows, weeklyScope, fourScope] = await Promise.all([
    existingReview(location.id, weekly),
    existingReview(location.id, fourWeekly),
    weekly ? rowsForPeriod(location.id, weekly, location.timezone) : emptyPeriodRows(),
    fourWeekly ? rowsForPeriod(location.id, fourWeekly, location.timezone) : emptyPeriodRows(),
  ]);
  const allIssueIds = [...new Set(currentIssues.map(issue => issue.id))];
  const [currentUpdates, currentRechecks, allReadings, allProbes] = await Promise.all([
    allIssueIds.length ? db().select().from(issueUpdates).where(inArray(issueUpdates.issueId, allIssueIds)).orderBy(asc(issueUpdates.createdAt)) : [],
    allIssueIds.length ? db().select().from(rechecks).where(inArray(rechecks.issueId, allIssueIds)).orderBy(asc(rechecks.createdAt)) : [],
    db().select().from(temperatureReadings).where(eq(temperatureReadings.locationId, location.id)),
    db().select().from(foodChecks).where(eq(foodChecks.locationId, location.id)),
  ]);
  const currentIssueRows = await issuePresentation(location.id, currentIssues.filter(issue => issue.status !== "resolved"), currentUpdates, currentRechecks, allReadings, allProbes, new Date());
  const resolvedIssueRows = await issuePresentation(location.id, currentIssues.filter(issue => issue.status === "resolved"), currentUpdates, currentRechecks, allReadings, allProbes, new Date());
  const historyNames = new Map(historyUsers.map(user => [user.id, user.name ?? user.email]));
  const weeklyState = reviewPeriodState(weekly, location.timezone, Boolean(weeklyRows), Date.now(), "weekly");
  const fourWeeklyState = reviewPeriodState(fourWeekly, location.timezone, Boolean(fourRows), Date.now(), "four_weekly");
  return {
    location: { id: location.id, name: location.name, timezone: location.timezone },
    teamMembers: locationMembers.map(member => ({ _id: member.id, name: member.name })),
    periods: {
      weekly: { ...weeklyState, completed: Boolean(weeklyRows), summary: summaryFor(weeklyScope.issueRows, weeklyScope.updateRows, weeklyScope.recheckRows, weeklyScope.readingRows, weeklyScope.probeRows, weeklyScope.start, weeklyScope.end) },
      four_weekly: { ...fourWeeklyState, completed: Boolean(fourRows), summary: summaryFor(fourScope.issueRows, fourScope.updateRows, fourScope.recheckRows, fourScope.readingRows, fourScope.probeRows, fourScope.start, fourScope.end) },
    },
    currentIssues: currentIssueRows,
    resolvedIssues: resolvedIssueRows,
    reviewHistory: historyRows.map(row => reviewDto(row, historyNames.get(row.completedBy) ?? null)),
  };
}

async function validateAnswers(value: unknown) {
  const record = jsonRecord(value);
  const answers: Record<string, "yes" | "no"> = {};
  for (let index = 0; index < FSA_REVIEW_QUESTIONS.length; index += 1) {
    const answer = requireEnum(record[String(index + 1)], `Question ${index + 1}`, ["yes", "no"] as const);
    answers[String(index + 1)] = answer;
  }
  return answers;
}

export async function completeManagerReview(context: AuthContext, input: Record<string, unknown>) {
  const location = await managedLocation(context, requireUuid(input.locationId, "locationId"));
  const reviewType = requireEnum(input.reviewType, "reviewType", ["weekly", "four_weekly"] as const);
  const completedRows = await db().select({ periodStart: managerReviews.periodStart, periodEnd: managerReviews.periodEnd }).from(managerReviews).where(and(eq(managerReviews.locationId, location.id), eq(managerReviews.reviewType, reviewType)));
  const expected = nextOutstandingReviewPeriod(completedRows, location.timezone, reviewType);
  const periodStart = requireString(input.periodStart, "periodStart");
  const periodEnd = requireString(input.periodEnd, "periodEnd");
  if (!expected) throw new ApiError(400, "No completed review period is available");
  const latestEligible = completedReviewPeriod(location.timezone, reviewType);
  if (expected.end > latestEligible.end) throw new ApiError(400, "Review period has not finished yet");
  if (periodStart !== expected.start || periodEnd !== expected.end) throw new ApiError(400, "Review period is not the latest completed period");
  if (await existingReview(location.id, expected)) throw new ApiError(409, "This review has already been completed");
  const scope = await rowsForPeriod(location.id, expected, location.timezone);
  const summary = summaryFor(scope.issueRows, scope.updateRows, scope.recheckRows, scope.readingRows, scope.probeRows, scope.start, scope.end);
  const updatesInput = reviewType === "weekly" && Array.isArray(input.issueUpdates) ? input.issueUpdates : [];
  const updates = updatesInput.map((value, index) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, `Issue update ${index + 1} is invalid`);
    const record = value as Record<string, unknown>;
    return { issueId: requireUuid(record.issueId, "issueId"), note: requireString(record.note, "Current position / next action") };
  });
  const currentIssueRows = reviewType === "weekly" ? await db().select().from(issues).where(and(eq(issues.locationId, location.id), inArray(issues.status, ["open", "monitoring"]))) : [];
  const issueMap = new Map((reviewType === "weekly" ? currentIssueRows : scope.issueRows).map(issue => [issue.id, issue]));
  if (reviewType === "weekly") {
    const updateIds = new Set<string>();
    for (const update of updates) {
      if (updateIds.has(update.issueId)) throw new ApiError(422, "Each issue may have only one manager review update");
      updateIds.add(update.issueId);
    }
    for (const issue of currentIssueRows) {
      const update = updates.find(item => item.issueId === issue.id);
      if (!update?.note.trim()) throw new ApiError(422, "Current position / next action is required for every open or monitoring issue");
    }
  }
  for (const update of updates) {
    const issue = issueMap.get(update.issueId);
    if (!issue || (reviewType !== "weekly" && statusAt(issue, scope.updateRows.filter(item => item.issueId === issue.id), scope.end) === "resolved")) throw new ApiError(422, "Issue update must reference an outstanding issue in the review period");
  }
  let seriousProblems: boolean | null = null;
  let details: string | null = null;
  let actionTaken: string | null = null;
  let answers: Record<string, "yes" | "no"> | null = null;
  if (reviewType === "four_weekly") {
    seriousProblems = requireBoolean(input.seriousProblems, "seriousProblems");
    if (seriousProblems) {
      details = requireString(input.details, "Details");
      actionTaken = requireString(input.actionTaken, "What did you do about it?");
    }
    answers = await validateAnswers(input.answers);
  }
  const timestamp = new Date();
  const result = await db().transaction(async tx => {
    for (const update of updates) {
      const issue = issueMap.get(update.issueId)!;
      const currentStatus = statusAt(issue, scope.updateRows.filter(item => item.issueId === issue.id), scope.end);
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "manager_review", note: update.note, status: currentStatus as "open" | "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: null });
    }
    const [review] = await tx.insert(managerReviews).values({ locationId: location.id, reviewType, periodStart, periodEnd, completedAt: timestamp, completedBy: context.user.id, summary, seriousProblems, details, actionTaken, answers }).returning();
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: `${reviewType}_manager_review_completed`, detail: `${reviewType === "weekly" ? "Weekly" : "4-week"} manager review completed for ${periodStart} to ${periodEnd}`, createdAt: timestamp });
    return review;
  });
  return reviewDto(result, context.user.name ?? context.user.email);
}

export async function listManagerReviewsForReport(context: AuthContext, locationId: string, start: Date, end: Date) {
  const location = await managedLocation(context, locationId);
  const rows = await db().select({ review: managerReviews, user: users }).from(managerReviews).innerJoin(users, eq(users.id, managerReviews.completedBy)).where(and(eq(managerReviews.locationId, location.id), gte(managerReviews.completedAt, start), lte(managerReviews.completedAt, end))).orderBy(asc(managerReviews.completedAt));
  return rows.map(row => reviewDto(row.review, row.user.name ?? row.user.email));
}
