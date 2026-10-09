/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { additionalCompletions, additionalRequirements, checklistQuestions, checklistResponses, checklistSignOffs, cleaningCompletions, cleaningTasks, equipment, foodChecks, issueUpdates, issues, locations, probeProducts, rechecks, securityQuestions, securityResponses, securitySignOffs, structuredTaskResponses, teamMembers, temperatureReadings, temperatureRounds, wastageRecords } from "../db/schema.js";
import { requireLocationManager, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { localDateKey, localDayRange } from "../compliance/validation.js";
import { calendar } from "../history/service.js";
import { correctiveActionLabel, issueStatusLabel, resultLabel } from "../../lib/temperature-resolution.js";
import { hasCorrectiveActionOnDay } from "../compliance/corrective-action.js";
import { asOfIssue, evaluatedDays, reportDateRange, REPORT_SECTION_KEYS, sectionCompletion, type ReportSectionKey } from "./calculations.js";
import { listManagerReviewsForReport } from "../reviews/service.js";
import { cleaningIsScheduledForDate } from "../../shared/cleaning-scheduling.js";
import { checklistDefinitionKey, checklistVersionRoot } from "../../shared/unified-checklist.js";

const db = () => getDb();
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value == null ? null : String(value);

async function managedLocation(context: AuthContext, locationId: string) {
  const [location] = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  return location;
}

const inLocalDay = (row: any, field: string, date: string, timezone: string) => {
  const value = row[field];
  return value instanceof Date && localDateKey(value.getTime(), timezone) === date;
};

export async function complianceReport(context: AuthContext, input: { locationId: string; start: unknown; end: unknown }) {
  const location = await managedLocation(context, input.locationId);
  const range = reportDateRange(input.start, input.end);
  const startMs = localDayRange(Date.parse(`${range.start}T12:00:00Z`), location.timezone).start;
  const endMs = localDayRange(Date.parse(`${range.end}T12:00:00Z`), location.timezone).end - 1;
  const start = new Date(startMs);
  const end = new Date(endMs);

  const [calendarResult, readings, rounds, probes, checklist, checklistSignoffs, security, securitySignoffs, cleaning, wastage, issuesRows, updates, recheckRows, equipmentRows, checklistQuestionRows, securityQuestionRows, cleaningTaskRows, probeProductRows, requirementRows, completionRows, members, structuredResponses] = await Promise.all([
    calendar(context, { locationId: location.id, monthStart: range.start, monthEnd: range.end }),
    db().select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, location.id), lte(temperatureReadings.createdAt, end))),
    db().select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), gte(temperatureRounds.startedAt, start), lte(temperatureRounds.startedAt, end))),
    db().select().from(foodChecks).where(and(eq(foodChecks.locationId, location.id), lte(foodChecks.createdAt, end))),
    db().select().from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), gte(checklistResponses.createdAt, start), lte(checklistResponses.createdAt, end))),
    db().select().from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), gte(checklistSignOffs.completedAt, start), lte(checklistSignOffs.completedAt, end))),
    db().select().from(securityResponses).where(and(eq(securityResponses.locationId, location.id), gte(securityResponses.createdAt, start), lte(securityResponses.createdAt, end))),
    db().select().from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), gte(securitySignOffs.completedAt, start), lte(securitySignOffs.completedAt, end))),
    db().select().from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), gte(cleaningCompletions.completedAt, start), lte(cleaningCompletions.completedAt, end))),
    db().select().from(wastageRecords).where(and(eq(wastageRecords.locationId, location.id), gte(wastageRecords.createdAt, start), lte(wastageRecords.createdAt, end))),
    db().select().from(issues).where(and(eq(issues.locationId, location.id), lte(issues.createdAt, end))),
    db().select().from(issueUpdates).where(and(eq(issueUpdates.locationId, location.id), lte(issueUpdates.createdAt, end))),
    db().select().from(rechecks).where(and(eq(rechecks.locationId, location.id), lte(rechecks.createdAt, end))),
    db().select().from(equipment).where(eq(equipment.locationId, location.id)),
    db().select().from(checklistQuestions).where(eq(checklistQuestions.locationId, location.id)),
    db().select().from(securityQuestions).where(eq(securityQuestions.locationId, location.id)),
    db().select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id)),
    db().select().from(probeProducts).where(eq(probeProducts.organisationId, location.organisationId)),
    db().select().from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)),
    db().select().from(additionalCompletions).where(and(eq(additionalCompletions.locationId, location.id), gte(additionalCompletions.completedAt, start), lte(additionalCompletions.completedAt, end))),
    db().select().from(teamMembers).where(eq(teamMembers.locationId, location.id)),
    db().select().from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, location.id), gte(structuredTaskResponses.createdAt, start), lte(structuredTaskResponses.createdAt, end))),
  ]);

  const memberNames = new Map(members.map(member => [member.id, member.name]));
  const equipmentNames = new Map(equipmentRows.map(item => [item.id, item.name]));
  const checklistLabels = new Map(checklistQuestionRows.map(question => [question.id, question.question]));
  const securityLabels = new Map(securityQuestionRows.map(question => [question.id, question.question]));
  const requirementLabels = new Map(requirementRows.map(requirement => [requirement.id, requirement.title]));
  const structuredLabels = new Map([...checklistQuestionRows, ...securityQuestionRows, ...cleaningTaskRows].map(task => [task.id, { title: "question" in task ? task.question : task.name, area: "checklist" in task ? task.checklist : "session" in task ? task.session === "AM" ? "security_am" : "security_pm" : "cleaning", steps: Array.isArray(task.steps) ? task.steps : [] }]));
  const memberName = (id: string | null | undefined) => id ? memberNames.get(id) ?? null : null;
  const rootFor = (items: any[], id: string) => items.find(item => item.id === id)?.versionRootId ?? id;
  const configApplies = (item: any, date: string) => localDateKey(item.createdAt.getTime(), location.timezone) <= date && (!item.deactivatedAt || localDateKey(item.deactivatedAt.getTime(), location.timezone) >= date);
  const selectVersions = (items: any[], date: string) => {
    const selected = new Map<string, any>();
    for (const item of items) {
      if (localDateKey(item.createdAt.getTime(), location.timezone) > date) continue;
      const root = item.versionRootId ?? item.id;
      const previous = selected.get(root);
      if (!previous || item.createdAt > previous.createdAt) selected.set(root, item);
    }
    return [...selected.values()].filter(item => configApplies(item, date));
  };
  const selectVersionsAt = (items: any[], timestamp: Date) => {
    const selected = new Map<string, any>();
    for (const item of items) {
      if (item.createdAt > timestamp) continue;
      const root = item.versionRootId ?? item.id;
      const previous = selected.get(root);
      if (!previous || item.createdAt > previous.createdAt) selected.set(root, item);
    }
    return [...selected.values()].filter(item => !item.deactivatedAt || item.deactivatedAt >= timestamp);
  };
  const allTaskVersions = [...checklistQuestionRows, ...securityQuestionRows, ...cleaningTaskRows];
  const responseMatchesTask = (task: any, response: any) => {
    if (task.id === response.taskId) return true;
    const previous = allTaskVersions.find(candidate => candidate.id === response.taskId);
    return Boolean(previous && checklistVersionRoot(previous) === checklistVersionRoot(task) && checklistDefinitionKey(previous) === checklistDefinitionKey(task));
  };
  const openingQuestions = checklistQuestionRows.filter(question => question.checklist === "opening");
  const closingQuestions = checklistQuestionRows.filter(question => question.checklist === "closing");
  const amQuestions = securityQuestionRows.filter(question => question.session === "AM");
  const pmQuestions = securityQuestionRows.filter(question => question.session === "PM");
  const flagsFor = (date: string) => {
    const dayRounds = rounds.filter(round => localDateKey(round.startedAt.getTime(), location.timezone) === date);
    const dayReadings = readings.filter(reading => inLocalDay(reading, "createdAt", date, location.timezone));
    const dayProbes = probes.filter(probe => inLocalDay(probe, "createdAt", date, location.timezone));
    const dayChecklist = checklist.filter(response => inLocalDay(response, "createdAt", date, location.timezone));
    const daySecurity = security.filter(response => inLocalDay(response, "createdAt", date, location.timezone));
    const openingSignoff = checklistSignoffs.find(signoff => signoff.checklist === "opening" && signoff.dateKey === date);
    const closingSignoff = checklistSignoffs.find(signoff => signoff.checklist === "closing" && signoff.dateKey === date);
    const amSignoff = securitySignoffs.find(signoff => signoff.session === "AM" && signoff.dateKey === date);
    const pmSignoff = securitySignoffs.find(signoff => signoff.session === "PM" && signoff.dateKey === date);
    const responseIds = (rows: any[]) => new Set(rows.filter(row => inLocalDay(row, "createdAt", date, location.timezone)).map(row => row.questionId));
    const openingRequired = openingSignoff ? selectVersionsAt(openingQuestions, openingSignoff.completedAt) : selectVersions(openingQuestions, date);
    const closingRequired = closingSignoff ? selectVersionsAt(closingQuestions, closingSignoff.completedAt) : selectVersions(closingQuestions, date);
    const amRequired = amSignoff ? selectVersionsAt(amQuestions, amSignoff.completedAt) : selectVersions(amQuestions, date);
    const pmRequired = pmSignoff ? selectVersionsAt(pmQuestions, pmSignoff.completedAt) : selectVersions(pmQuestions, date);
    const openingComplete = openingRequired.every(question => responseIds(checklist).has(question.id)) && Boolean(openingSignoff);
    const closingComplete = closingRequired.every(question => responseIds(checklist).has(question.id)) && Boolean(closingSignoff);
    const amSecurityComplete = amRequired.every(question => responseIds(security).has(question.id)) && Boolean(amSignoff);
    const pmSecurityComplete = pmRequired.every(question => responseIds(security).has(question.id)) && Boolean(pmSignoff);
    const requiredEquipment = equipmentRows.filter(item => configApplies(item, date));
    const roundComplete = (session: string) => dayRounds.filter(round => round.session === session && round.completedAt).some(round => requiredEquipment.every(item => dayReadings.some(reading => reading.roundId === round.id && reading.equipmentId === item.id)));
    const probeRequired = selectVersions(probeProductRows.filter(product => (product.locationIds ?? []).includes(location.id)), date);
    const probeComplete = probeRequired.length === 0 || probeRequired.every(product => dayProbes.some(probe => probe.probeProductId ? rootFor(probeProductRows, probe.probeProductId) === (product.versionRootId ?? product.id) : probe.product === product.name));
    const selectedCleaning = selectVersions(cleaningTaskRows, date);
    const cleaningRequired = selectedCleaning.filter(task => cleaningIsScheduledForDate(task.frequency, task.weekdays, date, location.timezone));
    const cleaningAfterUse = selectedCleaning.some(task => task.frequency === "after_use");
    const structuredCleaning = structuredResponses.filter(response => response.taskArea === "cleaning" && localDateKey(response.createdAt.getTime(), location.timezone) === date);
    const cleaningComplete = cleaningRequired.every(task => cleaning.some(done => done.dateKey === date && rootFor(cleaningTaskRows, done.taskId) === (task.versionRootId ?? task.id)) || (task.taskType === "with_steps" ? (task.steps ?? []).filter((step: any) => step.required !== false).every((step: any) => structuredCleaning.some(response => response.stepId === step.id && responseMatchesTask(task, response))) : structuredCleaning.some(response => response.stepId === "simple" && responseMatchesTask(task, response))));
    const cleaningStatus: "complete" | "incomplete" | "not_verifiable" | "not_required" = cleaningRequired.length ? (cleaningComplete ? "complete" : "incomplete") : cleaningAfterUse ? "not_verifiable" : "not_required";
    const additionalDue = selectVersions(requirementRows, date).filter(requirement => localDateKey(requirement.nextDueAt.getTime(), location.timezone) === date);
    const additionalComplete = additionalDue.every(requirement => completionRows.some(done => rootFor(requirementRows, done.requirementId) === (requirement.versionRootId ?? requirement.id) && done.scheduledDueAt && localDateKey(done.scheduledDueAt.getTime(), location.timezone) === date && localDateKey(done.completedAt.getTime(), location.timezone) === date));
    const dayWastage = wastage.filter(record => inLocalDay(record, "createdAt", date, location.timezone));
    return {
      temperature_am: roundComplete("AM"), temperature_pm: roundComplete("PM"), opening_checklist: openingComplete, closing_checklist: closingComplete,
      security_am: amSecurityComplete, security_pm: pmSecurityComplete, food_probes: probeComplete, cleaning: cleaningStatus === "complete" ? true : cleaningStatus === "incomplete" ? false : null,
      wastage: dayWastage.length > 0, additional_checks: additionalComplete,
      cleaningStatus,
      counts: { temperatureReadings: dayReadings.length, foodProbes: dayProbes.length, checklistResponses: dayChecklist.length, securityResponses: daySecurity.length, cleaningCompletions: cleaning.filter(done => done.dateKey === date).length + structuredCleaning.length, wastageRecords: dayWastage.length, additionalChecks: completionRows.filter(done => inLocalDay(done, "completedAt", date, location.timezone)).length },
    };
  };

  const today = localDateKey(Date.now(), location.timezone);
  const exceptionRows: any[] = [];
  const issueFor = (field: string, id: string) => issuesRows.find(issue => (issue as any)[field] === id) ?? null;
  const updatesFor = (issueId: string) => updates.filter(update => update.issueId === issueId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const rechecksFor = (issueId: string) => recheckRows.filter(recheck => recheck.issueId === issueId).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const statusAtEnd = (issue: any) => {
    const relevantUpdates = updatesFor(issue.id);
    if (issue.resolvedAt && issue.resolvedAt <= end) return "resolved";
    if (relevantUpdates.length) return relevantUpdates[relevantUpdates.length - 1].status;
    return issue.status === "resolved" ? "open" : issue.status;
  };
  const resolutionUpdateFor = (issueId: string) => updatesFor(issueId).find(update => update.updateType === "resolution");
  const issueJourney = (issue: any) => {
    const sourceReading = readings.find(reading => reading.id === issue.sourceTemperatureReadingId);
    const events = [
      sourceReading ? { eventType: "original_failure", occurredAt: iso(sourceReading.createdAt), title: "Original failed reading", detail: `${sourceReading.equipmentName ?? equipmentNames.get(sourceReading.equipmentId) ?? "Equipment"} · ${sourceReading.temperature}°C`, result: "fail", teamMemberName: memberName(sourceReading.teamMemberId) } : null,
      { eventType: "issue_created", occurredAt: iso(issue.createdAt), title: "Issue created", detail: issue.description, result: "open", teamMemberName: memberName(issue.teamMemberId) },
      ...updatesFor(issue.id).map(update => ({ eventType: update.updateType, occurredAt: iso(update.createdAt), title: update.updateType === "resolution" ? "Resolution" : "Corrective action", detail: update.note, result: update.status, teamMemberName: memberName(update.teamMemberId) })),
      ...rechecksFor(issue.id).map(recheck => ({ eventType: "recheck", occurredAt: iso(recheck.createdAt), title: "Recheck", detail: `Temperature ${recheck.temperature}°C`, result: recheck.result, teamMemberName: memberName(recheck.teamMemberId) })),
      issue.resolvedAt && issue.resolvedAt <= end ? { eventType: "issue_resolved", occurredAt: iso(issue.resolvedAt), title: "Issue resolved", detail: issue.resolutionNote ?? "Issue marked resolved", result: "resolved", teamMemberName: memberName(resolutionUpdateFor(issue.id)?.teamMemberId) } : null,
    ].filter(Boolean) as any[];
    const priorityFor = (event: any) => event.eventType === "original_failure" ? 10 : event.eventType === "issue_created" ? 20 : event.eventType === "recheck" ? 40 : event.eventType === "issue_resolved" ? 50 : 30;
    return events.sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)) || priorityFor(a) - priorityFor(b));
  };
  const temperatureResolution = (issue: any) => {
    if (!issue) return { issueStatus: null, issueStatusLabel: null, correctiveActionStatus: null, latestRecheck: null, latestAction: null };
    const issueStatus = statusAtEnd(issue);
    const relevantUpdates = updatesFor(issue.id);
    const latestAction = [...relevantUpdates].reverse().find(update => update.updateType === "immediate_action" || update.updateType === "action" || update.updateType === "further_action") ?? null;
    const rechecks = rechecksFor(issue.id);
    const latestRecheck = rechecks[rechecks.length - 1] ?? null;
    return {
      issueStatus,
      issueStatusLabel: issueStatusLabel(issueStatus),
      correctiveActionStatus: correctiveActionLabel({ issueStatus, hasAction: Boolean(latestAction), latestRecheckResult: latestRecheck?.result }),
      latestRecheck: latestRecheck ? { temperature: latestRecheck.temperature, result: latestRecheck.result, resultLabel: resultLabel(latestRecheck.result), occurredAt: iso(latestRecheck.createdAt), teamMemberName: memberName(latestRecheck.teamMemberId) } : null,
      latestAction: latestAction ? { note: latestAction.note, occurredAt: iso(latestAction.createdAt), teamMemberName: memberName(latestAction.teamMemberId) } : null,
    };
  };
  for (const reading of readings.filter(row => row.result === "fail" && row.createdAt >= start && row.createdAt <= end)) {
    const issue = issueFor("sourceTemperatureReadingId", reading.id);
    exceptionRows.push({ type: "temperature", date: localDateKey(reading.createdAt.getTime(), location.timezone), occurredAt: iso(reading.createdAt), label: reading.equipmentName ?? equipmentNames.get(reading.equipmentId) ?? "Equipment", value: `${reading.temperature}°C`, result: "fail", teamMemberName: memberName(reading.teamMemberId), relatedIssueId: issue?.id ?? null, ...temperatureResolution(issue) });
  }
  for (const probe of probes.filter(row => row.result === "fail" && row.createdAt >= start && row.createdAt <= end)) {
    const issue = issueFor("sourceFoodCheckId", probe.id);
    exceptionRows.push({ type: "food_probe", date: localDateKey(probe.createdAt.getTime(), location.timezone), occurredAt: iso(probe.createdAt), label: probe.product, value: `${probe.temperature}°C`, result: "fail", teamMemberName: memberName(probe.teamMemberId), relatedIssueId: issue?.id ?? null });
  }
  for (const response of checklist.filter(row => row.answer === "no")) exceptionRows.push({ type: "checklist", date: localDateKey(response.createdAt.getTime(), location.timezone), occurredAt: iso(response.createdAt), label: checklistLabels.get(response.questionId) ?? "Checklist question", detail: [response.problem, response.action].filter(Boolean).join(" · "), result: "no", teamMemberName: memberName(response.teamMemberId) });
  for (const response of security.filter(row => row.answer === "no" || Boolean(row.issue))) exceptionRows.push({ type: "security", date: localDateKey(response.createdAt.getTime(), location.timezone), occurredAt: iso(response.createdAt), label: securityLabels.get(response.questionId) ?? "Security question", detail: response.issue ?? "", result: response.answer, teamMemberName: memberName(response.teamMemberId) });
  for (const response of structuredResponses.filter(row => ["no", "fail", "false"].includes(String(row.responseValue).trim().toLowerCase()))) {
    const task = structuredLabels.get(response.taskId);
    const step = task?.steps.find(item => item.id === response.stepId);
    exceptionRows.push({ type: task?.area ?? response.taskArea, date: localDateKey(response.createdAt.getTime(), location.timezone), occurredAt: iso(response.createdAt), label: task?.title ?? "Structured task", detail: [step?.label, response.responseValue].filter(Boolean).join(" · "), result: "no", teamMemberName: memberName(response.teamMemberId) });
  }

  const dayRows = calendarResult.days.map((day: any) => {
    const flags = flagsFor(day.date);
    const eventsOnDay = [...issuesRows.filter(issue => inLocalDay(issue, "createdAt", day.date, location.timezone)), ...updates.filter(update => inLocalDay(update, "createdAt", day.date, location.timezone)), ...recheckRows.filter(recheck => inLocalDay(recheck, "createdAt", day.date, location.timezone)), ...issuesRows.filter(issue => inLocalDay(issue, "resolvedAt", day.date, location.timezone))];
    const correctiveActionRecorded = hasCorrectiveActionOnDay({ date: day.date, timezone: location.timezone, updates, checklistResponses: checklist, probes });
    return { date: day.date, status: day.status, complete: day.complete, cleaningStatus: flags.cleaningStatus, correctiveActionRecorded, sections: Object.fromEntries(REPORT_SECTION_KEYS.map(key => [key, flags[key as ReportSectionKey]])), counts: { ...flags.counts, rounds: day.rounds, checklistSignoffs: day.checklistSignoffs, securitySignoffs: day.securitySignoffs, issueEvents: eventsOnDay.length } };
  });
  const evaluated = evaluatedDays(dayRows, today);
  const sections = Object.fromEntries(REPORT_SECTION_KEYS.map(key => [key, sectionCompletion(dayRows, key, today)]));
  const openIssuesAtStart = evaluated.filter(day => {
    const dayStart = new Date(localDayRange(Date.parse(`${day.date}T12:00:00Z`), location.timezone).start);
    return issuesRows.some(issue => issue.createdAt < dayStart && asOfIssue(issue, dayStart));
  }).length;
  const issueRows = issuesRows.filter(issue => {
    const createdInRange = issue.createdAt >= start && issue.createdAt <= end;
    const resolvedInRange = Boolean(issue.resolvedAt && issue.resolvedAt >= start && issue.resolvedAt <= end);
    const updatedInRange = updates.some(update => update.issueId === issue.id && update.createdAt >= start && update.createdAt <= end);
    const recheckedInRange = recheckRows.some(recheck => recheck.issueId === issue.id && recheck.createdAt >= start && recheck.createdAt <= end);
    return createdInRange || resolvedInRange || updatedInRange || recheckedInRange || asOfIssue(issue, end);
  }).map(issue => {
    const relevantUpdates = updatesFor(issue.id);
    const latest = relevantUpdates[relevantUpdates.length - 1];
    const latestAction = [...relevantUpdates].reverse().find(update => update.updateType === "immediate_action" || update.updateType === "action" || update.updateType === "further_action");
    const sourceReading = issue.sourceTemperatureReadingId ? readings.find(reading => reading.id === issue.sourceTemperatureReadingId) : null;
    const sourceProbe = issue.sourceFoodCheckId ? probes.find(probe => probe.id === issue.sourceFoodCheckId) : null;
    return {
      id: issue.id,
      title: issue.title,
      category: issue.category,
      description: issue.description,
      originalReading: issue.originalReading ?? (sourceReading ? `${sourceReading.temperature}°C` : sourceProbe ? `${sourceProbe.temperature}°C` : null),
      originalLabel: sourceReading?.equipmentName ?? sourceProbe?.product ?? null,
      originalOccurredAt: iso(sourceReading?.createdAt ?? sourceProbe?.createdAt ?? issue.createdAt),
      createdAt: iso(issue.createdAt),
      status: statusAtEnd(issue),
      resolvedAt: iso(issue.resolvedAt),
      teamMemberName: memberName(issue.teamMemberId),
      recheckCount: rechecksFor(issue.id).length,
      latestAction: latestAction ? { occurredAt: iso(latestAction.createdAt), note: latestAction.note, status: latestAction.status, teamMemberName: memberName(latestAction.teamMemberId) } : null,
      latestUpdate: latest ? { occurredAt: iso(latest.createdAt), note: latest.note, status: latest.status, teamMemberName: memberName(latest.teamMemberId) } : null,
      journey: issueJourney(issue),
    };
  });
  const additionalByDate = evaluated.map(day => {
    const due = selectVersions(requirementRows, day.date).filter(requirement => localDateKey(requirement.nextDueAt.getTime(), location.timezone) === day.date);
    const completed = due.filter(requirement => completionRows.some(done => rootFor(requirementRows, done.requirementId) === (requirement.versionRootId ?? requirement.id) && done.scheduledDueAt && localDateKey(done.scheduledDueAt.getTime(), location.timezone) === day.date && localDateKey(done.completedAt.getTime(), location.timezone) === day.date));
    return { date: day.date, due: due.length, completed: completed.length, incomplete: due.length - completed.length };
  });
  const additionalRows = completionRows.map(row => ({ requirementTitle: requirementLabels.get(row.requirementId) ?? "Additional check", scheduledDueDate: row.scheduledDueAt ? localDateKey(row.scheduledDueAt.getTime(), location.timezone) : null, completedAt: iso(row.completedAt), teamMemberName: memberName(row.teamMemberId), certificatePresent: Boolean(row.certificateReference || row.documentId), documentUrl: row.documentId ? `/api/documents/${row.documentId}` : null }));
  const wastageDays = new Set(wastage.map(row => localDateKey(row.createdAt.getTime(), location.timezone)));
  const summary = { daysEvaluated: evaluated.length, completeDays: evaluated.filter(day => day.complete).length, incompleteDays: evaluated.filter(day => !day.complete).length, correctiveActionDays: evaluated.filter(day => day.correctiveActionRecorded).length, daysWithOpenIssueAtStart: openIssuesAtStart, daysWithTemperatureFailure: new Set(exceptionRows.filter(row => row.type === "temperature").map(row => row.date)).size, daysWithProbeFailure: new Set(exceptionRows.filter(row => row.type === "food_probe").map(row => row.date)).size, completionRate: evaluated.length ? evaluated.filter(day => day.complete).length / evaluated.length : null };
  const additionalSummary = { due: additionalByDate.reduce((sum, row) => sum + row.due, 0), completed: additionalByDate.reduce((sum, row) => sum + row.completed, 0), incomplete: additionalByDate.reduce((sum, row) => sum + row.incomplete, 0), rows: additionalRows };
  const managerReviewRows = await listManagerReviewsForReport(context, location.id, start, end);
  return {
    location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone },
    range: { start: range.start, end: range.end, timezone: location.timezone },
    summary,
    sections,
    days: dayRows,
    exceptions: exceptionRows,
    issues: { issuesCreated: issuesRows.filter(issue => issue.createdAt >= start && issue.createdAt <= end).length, issuesResolved: issuesRows.filter(issue => issue.resolvedAt && issue.resolvedAt >= start && issue.resolvedAt <= end).length, rechecksRecorded: recheckRows.filter(row => row.createdAt >= start && row.createdAt <= end).length, openAtRangeEnd: issueRows.filter(issue => issue.status !== "resolved").length, rows: issueRows },
    wastage: { totalRecords: wastage.length, noWasteRecords: wastage.filter(row => row.noWaste).length, daysWithRecord: wastageDays.size, evaluatedDaysMissingEvidence: evaluated.filter(day => !wastageDays.has(day.date)).length },
    additional: additionalSummary,
    managerReviews: { rows: managerReviewRows },
  };
}
