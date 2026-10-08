/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { additionalCompletions, additionalRequirements, checklistQuestions, checklistResponses, checklistSignOffs, cleaningCompletions, cleaningTasks, documents, equipment, foodChecks, issueUpdates as issueUpdatesTable, issues, locations, probeProducts, rechecks as rechecksTable, securityQuestions, securityResponses, securitySignOffs, structuredTaskResponses, teamMembers, temperatureReadings, temperatureRounds, wastageRecords } from "../db/schema.js";
import { requireLocationAccess, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { localDateKey, localDayRange } from "../compliance/validation.js";
import { localWeekday } from "../dashboard/time.js";
import { buildInspectionChronology, carriedOpenIssues } from "./chronology.js";
import { hasCorrectiveActionOnDay } from "../compliance/corrective-action.js";
import { checklistDefinitionKey, checklistVersionRoot } from "../../shared/unified-checklist.js";

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
  const [rounds, readings, issuesRows, probes, checklist, security, cleaning, wastage, allEquipment, openingQuestions, closingQuestions, amQuestions, pmQuestions, checklistSignoffs, securitySignoffs, allCleaningTasks, allProbeProducts, dueRequirements, additionalDone, structuredResponses] = await Promise.all([
    db.select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), gte(temperatureRounds.startedAt, start), lte(temperatureRounds.startedAt, end))),
    db.select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, location.id), gte(temperatureReadings.createdAt, start), lte(temperatureReadings.createdAt, end))),
    db.select().from(issues).where(and(eq(issues.locationId, location.id), lte(issues.createdAt, end))),
    db.select().from(foodChecks).where(and(eq(foodChecks.locationId, location.id), gte(foodChecks.createdAt, start), lte(foodChecks.createdAt, end))),
    db.select().from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), gte(checklistResponses.createdAt, start), lte(checklistResponses.createdAt, end))),
    db.select().from(securityResponses).where(and(eq(securityResponses.locationId, location.id), gte(securityResponses.createdAt, start), lte(securityResponses.createdAt, end))),
    db.select().from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), gte(cleaningCompletions.completedAt, start), lte(cleaningCompletions.completedAt, end))),
    db.select().from(wastageRecords).where(and(eq(wastageRecords.locationId, location.id), gte(wastageRecords.createdAt, start), lte(wastageRecords.createdAt, end))),
    db.select().from(equipment).where(eq(equipment.locationId, location.id)),
    db.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, "opening"))),
    db.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, "closing"))),
    db.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, "AM"))),
    db.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, "PM"))),
    db.select().from(checklistSignOffs).where(eq(checklistSignOffs.locationId, location.id)),
    db.select().from(securitySignOffs).where(eq(securitySignOffs.locationId, location.id)),
    db.select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id)),
    db.select().from(probeProducts).where(eq(probeProducts.organisationId, location.organisationId)),
    db.select().from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)),
    db.select().from(additionalCompletions).where(eq(additionalCompletions.locationId, location.id)),
    db.select().from(structuredTaskResponses).where(eq(structuredTaskResponses.locationId, location.id)),
  ]);
  const configApplies = (item: any, date: string) => localDateKey(item.createdAt.getTime(), location.timezone) <= date && (!item.deactivatedAt || localDateKey(item.deactivatedAt.getTime(), location.timezone) >= date);
  const selectVersions = (items: any[], date: string) => { const selected = new Map<string, any>(); for (const item of items) { if (localDateKey(item.createdAt.getTime(), location.timezone) > date) continue; const root = item.versionRootId ?? item.id; const old = selected.get(root); if (!old || item.createdAt > old.createdAt) selected.set(root, item); } return [...selected.values()].filter(item => configApplies(item, date)); };
  const selectVersionsAt = (items: any[], timestamp: Date) => { const selected = new Map<string, any>(); for (const item of items) { if (item.createdAt > timestamp) continue; const root = item.versionRootId ?? item.id; const old = selected.get(root); if (!old || item.createdAt > old.createdAt) selected.set(root, item); } return [...selected.values()].filter(item => !item.deactivatedAt || item.deactivatedAt >= timestamp); };
  const rootFor = (items: any[], id: string) => { const item = items.find(candidate => candidate.id === id); return item ? (item.versionRootId ?? item.id) : id; };
  const allTaskVersions = [...openingQuestions, ...closingQuestions, ...amQuestions, ...pmQuestions, ...allCleaningTasks];
  const responseMatchesTask = (task: any, responseTaskId: string) => {
    if (task.id === responseTaskId) return true;
    const previous = allTaskVersions.find(candidate => candidate.id === responseTaskId);
    return Boolean(previous && checklistVersionRoot(previous) === checklistVersionRoot(task) && checklistDefinitionKey(previous) === checklistDefinitionKey(task));
  };
  const result = days.map(date => {
    const dayRounds = rounds.filter(r => localDateKey(r.startedAt.getTime(), location.timezone) === date); const dayReadings = readings.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date); const dayProbes = probes.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date); const dayIssues = issuesRows.filter((r: any) => localDateKey(r.createdAt.getTime(), location.timezone) <= date && (r.resolvedAt ? localDateKey(r.resolvedAt.getTime(), location.timezone) >= date : r.status !== "resolved")); const openingSignoff = checklistSignoffs.find(s => s.checklist === "opening" && s.dateKey === date); const closingSignoff = checklistSignoffs.find(s => s.checklist === "closing" && s.dateKey === date); const amSignoff = securitySignoffs.find(s => s.session === "AM" && s.dateKey === date); const pmSignoff = securitySignoffs.find(s => s.session === "PM" && s.dateKey === date); const openRequired = openingSignoff ? selectVersionsAt(openingQuestions, openingSignoff.completedAt) : selectVersions(openingQuestions, date); const closeRequired = closingSignoff ? selectVersionsAt(closingQuestions, closingSignoff.completedAt) : selectVersions(closingQuestions, date); const amRequired = amSignoff ? selectVersionsAt(amQuestions, amSignoff.completedAt) : selectVersions(amQuestions, date); const pmRequired = pmSignoff ? selectVersionsAt(pmQuestions, pmSignoff.completedAt) : selectVersions(pmQuestions, date); const structuredFor = (area: string) => structuredResponses.filter(response => response.taskArea === area && response.dateKey === date); const structuredComplete = (tasks: any[], area: string, legacyRows: any[]) => { const structured = structuredFor(area); return tasks.every(task => task.taskType === "with_steps" ? (task.steps ?? []).filter((step: any) => step.required !== false).every((step: any) => structured.some(response => response.stepId === step.id && responseMatchesTask(task, response.taskId))) : structured.some(response => response.stepId === "simple" && responseMatchesTask(task, response.taskId)) || legacyRows.some(response => responseMatchesTask(task, response.questionId))); }; const openingComplete = structuredComplete(openRequired, "opening", checklist) && Boolean(openingSignoff); const closingComplete = structuredComplete(closeRequired, "closing", checklist) && Boolean(closingSignoff); const amComplete = structuredComplete(amRequired, "security_am", security) && Boolean(amSignoff); const pmComplete = structuredComplete(pmRequired, "security_pm", security) && Boolean(pmSignoff); const requiredEquipment = allEquipment.filter(item => configApplies(item, date)); const roundsComplete = ["AM", "PM"].every(session => dayRounds.filter(r => r.session === session && r.completedAt).some(round => requiredEquipment.every(item => readings.some(reading => reading.roundId === round.id && reading.equipmentId === item.id)))); const probeRequired = selectVersions(allProbeProducts.filter(p => (p.locationIds ?? []).includes(location.id)), date); const probesComplete = probeRequired.length === 0 || probeRequired.every(product => dayProbes.some(probe => probe.probeProductId ? rootFor(allProbeProducts, probe.probeProductId) === (product.versionRootId ?? product.id) : probe.product === product.name)); const cleaningRequired = selectVersions(allCleaningTasks, date).filter(task => task.frequency === "after_use" || task.frequency === "daily" || (task.frequency === "weekly" && localWeekday(Date.parse(`${date}T12:00:00Z`), location.timezone) === 1) || (task.frequency === "specific_days" && (task.weekdays ?? []).includes(localWeekday(Date.parse(`${date}T12:00:00Z`), location.timezone)))); const cleaningComplete = cleaningRequired.every(task => cleaning.some(done => done.dateKey === date && rootFor(allCleaningTasks, done.taskId) === (task.versionRootId ?? task.id)) || (task.taskType === "with_steps" ? (task.steps ?? []).filter((step: any) => step.required !== false).every((step: any) => structuredFor("cleaning").some(response => response.stepId === step.id && responseMatchesTask(task, response.taskId))) : structuredFor("cleaning").some(response => response.stepId === "simple" && responseMatchesTask(task, response.taskId)))); const additionalDue = selectVersions(dueRequirements, date).filter(requirement => localDateKey(requirement.nextDueAt.getTime(), location.timezone) === date); const additionalComplete = additionalDue.every(requirement => additionalDone.some(done => rootFor(dueRequirements, done.requirementId) === (requirement.versionRootId ?? requirement.id) && done.scheduledDueAt && localDateKey(done.completedAt.getTime(), location.timezone) === date && localDateKey(done.completedAt.getTime(), location.timezone) === date)); const dayWastage = wastage.filter(item => localDateKey(item.createdAt.getTime(), location.timezone) === date); const failed = dayIssues.length > 0 || dayReadings.some(r => r.result === "fail") || dayProbes.some(r => r.result === "fail") || checklist.some(r => localDateKey(r.createdAt.getTime(), location.timezone) === date && r.answer === "no"); const complete = openingComplete && closingComplete && amComplete && pmComplete && roundsComplete && probesComplete && cleaningComplete && additionalComplete && dayWastage.length > 0; return { date, status: date > localDateKey(Date.now(), location.timezone) ? "grey" : complete ? (failed ? "amber" : "green") : "red", readings: dayReadings.length, probes: dayProbes.length, issues: dayIssues.length, rounds: dayRounds.length, checklistResponses: checklist.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date).length + structuredFor("opening").length + structuredFor("closing").length, securityResponses: security.filter(r => localDateKey(r.createdAt.getTime(), location.timezone) === date).length + structuredFor("security_am").length + structuredFor("security_pm").length, cleaningCompletions: cleaning.filter(r => r.dateKey === date).length + structuredFor("cleaning").length, wastageRecords: dayWastage.length, checklistSignoffs: { opening: Boolean(openingSignoff), closing: Boolean(closingSignoff) }, securitySignoffs: { AM: Boolean(amSignoff), PM: Boolean(pmSignoff) }, complete }; });
  return { location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone }, days: result };
}

export async function archive(context: AuthContext, input: { locationId: string; start: string; end: string }) {
  const location = await locationFor(context, input.locationId); const { from, to } = dayBounds(input.start, input.end); const start = new Date(localDayRange(Date.parse(`${from}T12:00:00Z`), location.timezone).start); const end = new Date(localDayRange(Date.parse(`${to}T12:00:00Z`), location.timezone).end - 1); const db = getDb();
  const [readings, rounds, probes, checklistResponseRows, checklistSignoffs, securityResponsesRows, securitySignoffs, wastage, cleaning, issuesRows, updates, recheckRows, equipmentRows, checklistQuestionsRows, securityQuestionsRows, cleaningTaskRows, structuredResponseRows] = await Promise.all([
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
    db.select().from(equipment).where(eq(equipment.locationId, location.id)),
    db.select().from(checklistQuestions).where(eq(checklistQuestions.locationId, location.id)),
    db.select().from(securityQuestions).where(eq(securityQuestions.locationId, location.id)),
    db.select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id)),
    db.select().from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, location.id), gte(structuredTaskResponses.createdAt, start), lte(structuredTaskResponses.createdAt, end))),
  ]);
  const issueIds = new Set(issuesRows.map(i => i.id)); const issueUpdates = updates.filter(u => issueIds.has(u.issueId)); const rechecks = recheckRows.filter(r => issueIds.has(r.issueId));
  const [additionalRows, requirementRows, memberRows] = await Promise.all([
    db.select().from(additionalCompletions).where(and(eq(additionalCompletions.locationId, location.id), gte(additionalCompletions.completedAt, start), lte(additionalCompletions.completedAt, end))),
    db.select().from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)),
    db.select().from(teamMembers).where(eq(teamMembers.locationId, location.id)),
  ]);
  const memberNames = new Map(memberRows.map(member => [member.id, member.name]));
  const equipmentNames = new Map(equipmentRows.map(item => [item.id, item.name]));
  const checklistLabels = new Map(checklistQuestionsRows.map(question => [question.id, question.question]));
  const securityLabels = new Map(securityQuestionsRows.map(question => [question.id, question.question]));
  const cleaningLabels = new Map(cleaningTaskRows.map(task => [task.id, task.name]));
  const structuredTaskLabels = new Map<string, { title: string; area: string; steps: any[] }>();
  for (const task of checklistQuestionsRows) structuredTaskLabels.set(task.id, { title: task.question, area: task.checklist, steps: Array.isArray(task.steps) ? task.steps : [] });
  for (const task of securityQuestionsRows) structuredTaskLabels.set(task.id, { title: task.question, area: task.session === "AM" ? "security_am" : "security_pm", steps: Array.isArray(task.steps) ? task.steps : [] });
  for (const task of cleaningTaskRows) structuredTaskLabels.set(task.id, { title: task.name, area: "cleaning", steps: Array.isArray(task.steps) ? task.steps : [] });
  const named = (teamMemberId: string | null | undefined) => teamMemberId ? memberNames.get(teamMemberId) ?? null : null;
  const additionalDocuments = additionalRows.map(row => row.documentId).filter((id): id is string => Boolean(id));
  const documentRows = additionalDocuments.length ? await db.select().from(documents).where(inArray(documents.id, additionalDocuments)) : [];
  const enrichedReadings = readings.map(row => ({ ...iso(row), session: rounds.find(round => round.id === row.roundId)?.session ?? null, equipmentName: row.equipmentName ?? equipmentNames.get(row.equipmentId) ?? null, relatedIssueId: issuesRows.find(issue => issue.sourceTemperatureReadingId === row.id)?.id ?? null, teamMemberName: named(row.teamMemberId) }));
  const enrichedRounds = rounds.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedProbes = probes.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const checklistResponse = (row: any) => ({ ...iso(row), question: checklistLabels.get(row.questionId) ?? null, teamMemberName: named(row.teamMemberId) });
  const securityResponse = (row: any) => ({ ...iso(row), question: securityLabels.get(row.questionId) ?? null, teamMemberName: named(row.teamMemberId) });
  const enrichedChecklistResponses = checklistResponseRows.map(checklistResponse);
  const enrichedChecklistSignoffs = checklistSignoffs.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedSecurityResponses = securityResponsesRows.map(securityResponse);
  const enrichedSecuritySignoffs = securitySignoffs.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedCleaning = cleaning.map(row => ({ ...iso(row), taskName: cleaningLabels.get(row.taskId) ?? null, teamMemberName: named(row.teamMemberId) }));
  const enrichedStructuredResponses = structuredResponseRows.map(row => {
    const task = structuredTaskLabels.get(row.taskId);
    const step = task?.steps.find(item => item.id === row.stepId);
    return { ...iso(row), taskTitle: task?.title ?? null, taskArea: task?.area ?? row.taskArea, stepLabel: step?.label ?? (row.stepId === "simple" ? task?.title ?? null : null), teamMemberName: named(row.teamMemberId) };
  });
  const enrichedWastage = wastage.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedIssues = issuesRows.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedUpdates = issueUpdates.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedRechecks = rechecks.map(row => ({ ...iso(row), teamMemberName: named(row.teamMemberId) }));
  const enrichedAdditional = additionalRows.map(row => {
    const value = iso(row) as any;
    delete value.documentStorageId;
    delete value.documentName;
    delete value.documentId;
    return { ...value, requirementTitle: requirementRows.find(requirement => requirement.id === row.requirementId)?.title ?? null, teamMemberName: named(row.teamMemberId), documentUrl: row.documentId && documentRows.some(document => document.id === row.documentId) ? `/api/documents/${row.documentId}` : null, issue: issuesRows.find(issue => issue.sourceAdditionalCompletionId === row.id) ?? null };
  });
  const chronology = buildInspectionChronology({ dayStart: start, dayEnd: end, readings: enrichedReadings, rounds: enrichedRounds, probes: enrichedProbes, checklistResponses: enrichedChecklistResponses, checklistSignoffs: enrichedChecklistSignoffs, securityResponses: enrichedSecurityResponses, securitySignoffs: enrichedSecuritySignoffs, cleaning: enrichedCleaning, structuredTaskResponses: enrichedStructuredResponses, wastage: enrichedWastage, additional: enrichedAdditional, issues: enrichedIssues, issueUpdates: enrichedUpdates, rechecks: enrichedRechecks });
  const carry = carriedOpenIssues(enrichedIssues, start);
  const calendarDay = (await calendar(context, { locationId: location.id, monthStart: from, monthEnd: to })).days[0];
  const summary = {
    status: calendarDay?.status === "green" ? "complete" : calendarDay?.status === "amber" ? "corrective_action" : calendarDay?.status === "grey" ? "future" : "incomplete",
    complete: Boolean(calendarDay?.complete),
    correctiveActionRecorded: hasCorrectiveActionOnDay({ date: from, timezone: location.timezone, updates, checklistResponses: enrichedChecklistResponses, probes: enrichedProbes }),
    carriedOpenIssueCount: carry.length,
    counts: {
      temperatureReadings: enrichedReadings.length,
      temperatureRounds: enrichedRounds.length,
      foodProbes: enrichedProbes.length,
      checklistResponses: enrichedChecklistResponses.length,
      checklistSignoffs: enrichedChecklistSignoffs.length,
      securityResponses: enrichedSecurityResponses.length,
      securitySignoffs: enrichedSecuritySignoffs.length,
      cleaningCompletions: enrichedCleaning.length,
      structuredTaskResponses: enrichedStructuredResponses.length,
      wastageRecords: enrichedWastage.length,
      additionalChecks: enrichedAdditional.length,
      issueEvents: chronology.filter(event => event.eventType.startsWith("issue_")).length,
    },
  };
  return {
    location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone },
    readings: enrichedReadings,
    rounds: enrichedRounds,
    probes: enrichedProbes,
    questions: { opening: enrichedChecklistResponses.filter(q => q.checklist === "opening"), closing: enrichedChecklistResponses.filter(q => q.checklist === "closing") },
    checklistSignOffs: enrichedChecklistSignoffs,
    securityResponses: { AM: enrichedSecurityResponses.filter(r => r.session === "AM"), PM: enrichedSecurityResponses.filter(r => r.session === "PM") },
    securitySignOffs: enrichedSecuritySignoffs,
    wastageRecords: enrichedWastage,
    cleaningCompletions: enrichedCleaning,
    structuredTaskResponses: enrichedStructuredResponses,
    issues: enrichedIssues,
    issueUpdates: enrichedUpdates,
    rechecks: enrichedRechecks,
    additionalCompletions: enrichedAdditional,
    chronology,
    summary,
    carriedOpenIssues: carry,
  };
}
