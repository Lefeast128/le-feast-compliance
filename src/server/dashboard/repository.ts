import { and, asc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  additionalCompletions, additionalRequirements, checklistQuestions, checklistResponses, checklistSignOffs,
  cleaningCompletions, cleaningTasks, equipment, foodChecks, issueUpdates, issues, locations,
  probeProducts, securityQuestions, securityResponses, securitySignOffs, scheduledTasks, teamMembers, documents,
  temperatureReadings, temperatureRounds, trainingCompletions, trainingContentVersions, trainingDocumentVersions, trainingRequirements,
  users, wastageItems, wastageRecords, structuredTaskResponses,
} from "../db/schema.js";
import { requireLocationAccess, type AuthContext } from "../auth/core.js";
import { localDateKey, localDayRange, localWeekday } from "./time.js";
import type { ApiLocation, DashboardResponse } from "../../shared/dashboard.js";

const serialize = <T>(value: T): T => {
  if (value instanceof Date) return value.toISOString() as T;
  if (Array.isArray(value)) return value.map(item => serialize(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)])) as T;
  return value;
};
const documentVersion = (value: { id: string; versionNumber: number; documentName: string; createdAt: Date | string; requiresReacknowledgement: boolean | null } | null | undefined) => value ? { id: value.id, versionNumber: value.versionNumber, documentName: value.documentName, createdAt: value.createdAt instanceof Date ? value.createdAt.toISOString() : value.createdAt, requiresReacknowledgement: value.requiresReacknowledgement } : null;

const locationDto = (location: typeof locations.$inferSelect): ApiLocation => ({
  id: location.id,
  organisationId: location.organisationId,
  name: location.name,
  shortName: location.shortName,
  timezone: location.timezone,
  active: location.active,
  createdAt: location.createdAt.toISOString(),
});

const roleFor = (context: AuthContext, locationId: string) => context.user.role === "admin"
  ? "admin" as const
  : context.memberships.find(membership => membership.locationId === locationId && membership.role === "manager")
    ? "manager" as const
    : "staff" as const;

export const listAccessibleLocations = async (context: AuthContext) => {
  const db = getDb();
  if (context.user.role === "admin" && context.user.organisationId) {
    const rows = await db.select().from(locations).where(and(eq(locations.organisationId, context.user.organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
    return rows.map(locationDto);
  }
  const ids = context.memberships.map(membership => membership.locationId);
  if (!ids.length) return [];
  const rows = await db.select().from(locations).where(and(inArray(locations.id, ids), eq(locations.active, true), context.user.organisationId ? eq(locations.organisationId, context.user.organisationId) : eq(locations.id, "00000000-0000-0000-0000-000000000000"))).orderBy(asc(locations.name));
  return rows.map(locationDto);
};

const dueCleaning = (task: typeof cleaningTasks.$inferSelect, weekday: number) => {
  const weekdays = Array.isArray(task.weekdays) ? task.weekdays : [];
  return task.active && (task.frequency === "after_use" || task.frequency === "daily" || (task.frequency === "weekly" && weekday === 1) || (task.frequency === "specific_days" && weekdays.includes(weekday)));
};

export const getDashboard = async (context: AuthContext, locationId: string): Promise<DashboardResponse> => {
  const db = getDb();
  const locationRows = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  const location = locationRows[0];
  if (!location) throw new Error("Location not found");
  requireLocationAccess(context, location.id, location.organisationId);

  const now = Date.now();
  const { start, end } = localDayRange(now, location.timezone);
  const todayKey = localDateKey(now, location.timezone);
  const from = new Date(start);
  const until = new Date(end);
  const [
    equipmentRows, tasks, rounds, readings, issueRows, foodRows, organisationProbeProducts,
    checklistQuestionRows, checklistResponseRows, checklistSignOffRows, securityQuestionRows,
    securityResponseRows, securitySignOffRows, wastageItemRows, wastageRowRows, cleaningTaskRows,
    cleaningCompletionRows, teamMemberRows, trainingRequirementRows, trainingCompletionRows,
    additionalRequirementRows, additionalCompletionRows, structuredTaskResponseRows,
  ] = await Promise.all([
    db.select().from(equipment).where(and(eq(equipment.locationId, location.id), eq(equipment.active, true))).orderBy(asc(equipment.order)),
    db.select().from(scheduledTasks).where(eq(scheduledTasks.locationId, location.id)),
    db.select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), gte(temperatureRounds.startedAt, from), lt(temperatureRounds.startedAt, until))),
    db.select().from(temperatureReadings).where(and(eq(temperatureReadings.locationId, location.id), gte(temperatureReadings.createdAt, from), lt(temperatureReadings.createdAt, until))),
    db.select().from(issues).where(and(eq(issues.locationId, location.id), ne(issues.status, "resolved"))),
    db.select().from(foodChecks).where(and(eq(foodChecks.locationId, location.id), gte(foodChecks.createdAt, from), lt(foodChecks.createdAt, until))),
    db.select().from(probeProducts).where(eq(probeProducts.organisationId, location.organisationId)),
    db.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.active, true))).orderBy(asc(checklistQuestions.order)),
    db.select().from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), gte(checklistResponses.createdAt, from), lt(checklistResponses.createdAt, until))),
    db.select().from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), eq(checklistSignOffs.dateKey, todayKey))),
    db.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.active, true))).orderBy(asc(securityQuestions.order)),
    db.select().from(securityResponses).where(and(eq(securityResponses.locationId, location.id), gte(securityResponses.createdAt, from), lt(securityResponses.createdAt, until))),
    db.select().from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), eq(securitySignOffs.dateKey, todayKey))),
    db.select().from(wastageItems).where(and(eq(wastageItems.locationId, location.id), eq(wastageItems.active, true))).orderBy(asc(wastageItems.order)),
    db.select().from(wastageRecords).where(and(eq(wastageRecords.locationId, location.id), gte(wastageRecords.createdAt, from), lt(wastageRecords.createdAt, until))),
    db.select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id)).orderBy(asc(cleaningTasks.order)),
    db.select().from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), eq(cleaningCompletions.dateKey, todayKey))),
    db.select().from(teamMembers).where(eq(teamMembers.locationId, location.id)),
    db.select().from(trainingRequirements).where(and(eq(trainingRequirements.locationId, location.id), eq(trainingRequirements.active, true))).orderBy(asc(trainingRequirements.order)),
    db.select().from(trainingCompletions).where(eq(trainingCompletions.locationId, location.id)),
    db.select().from(additionalRequirements).where(and(eq(additionalRequirements.locationId, location.id), eq(additionalRequirements.active, true), lt(additionalRequirements.nextDueAt, new Date(now + 1)))),
    db.select().from(additionalCompletions).where(eq(additionalCompletions.locationId, location.id)),
    db.select().from(structuredTaskResponses).where(and(eq(structuredTaskResponses.locationId, location.id), eq(structuredTaskResponses.dateKey, todayKey))),
  ]);

  const issueIds = issueRows.map(issue => issue.id);
  const issueUpdateRows = issueIds.length ? await db.select().from(issueUpdates).where(inArray(issueUpdates.issueId, issueIds)).orderBy(asc(issueUpdates.createdAt)) : [];
  const activeTeamMemberRows = teamMemberRows.filter(member => member.active);
  const teamNames = new Map(teamMemberRows.map(member => [member.id, member.name]));
  const userIds = [...new Set(issueRows.flatMap(issue => [issue.createdBy, issue.resolvedBy]).filter((id): id is string => Boolean(id)).concat(issueUpdateRows.map(update => update.createdBy)))];
  const userRows = userIds.length ? await db.select().from(users).where(inArray(users.id, userIds)) : [];
  const userNames = new Map(userRows.map(user => [user.id, user.name ?? user.email]));
  const issueData = issueRows.map(issue => ({
    ...serialize(issue),
    createdByName: userNames.get(issue.createdBy) ?? "Staff member",
    resolvedByName: issue.resolvedBy ? userNames.get(issue.resolvedBy) ?? "Manager" : undefined,
    updates: issueUpdateRows.filter(update => update.issueId === issue.id).map(update => ({ ...serialize(update), createdByName: userNames.get(update.createdBy) ?? "Staff member" })),
  }));

  const probeData = organisationProbeProducts.filter(product => product.active && (product.locationIds ?? []).includes(location.id)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const checklists = {
    opening: { questions: checklistQuestionRows.filter(question => question.checklist === "opening"), responses: checklistResponseRows.filter(response => response.checklist === "opening") },
    closing: { questions: checklistQuestionRows.filter(question => question.checklist === "closing"), responses: checklistResponseRows.filter(response => response.checklist === "closing") },
  };
  const security = {
    AM: securityQuestionRows.filter(question => question.session === "AM"),
    PM: securityQuestionRows.filter(question => question.session === "PM"),
  };
  const securityData = {
    AM: securityResponseRows.filter(response => response.session === "AM"),
    PM: securityResponseRows.filter(response => response.session === "PM"),
  };
  const weekday = localWeekday(now, location.timezone);
  const cleaningData = cleaningTaskRows.filter(task => dueCleaning(task, weekday));
  const structuredTasks = [
    ...checklistQuestionRows.map(row => ({ id: row.id, locationId: row.locationId, area: row.checklist, title: row.question, description: row.description, taskType: row.taskType, steps: row.steps, centralItemId: row.centralItemId, order: row.order })),
    ...cleaningData.map(row => ({ id: row.id, locationId: row.locationId, area: "cleaning" as const, title: row.name, description: row.description, taskType: row.taskType, steps: row.steps, centralItemId: row.centralItemId, order: row.order, frequency: row.frequency, weekdays: row.weekdays })),
    ...securityQuestionRows.map(row => ({ id: row.id, locationId: row.locationId, area: row.session === "AM" ? "security_am" as const : "security_pm" as const, title: row.question, description: row.description, taskType: row.taskType, steps: row.steps, centralItemId: row.centralItemId, order: row.order })),
  ];
  const currentVersions = trainingRequirementRows.length ? await db.select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.requirementId, trainingRequirementRows.map(requirement => requirement.id))) : [];
  const contentVersions = trainingRequirementRows.length ? await db.select().from(trainingContentVersions).where(inArray(trainingContentVersions.requirementId, trainingRequirementRows.map(requirement => requirement.id))) : [];
  const versionIds = [...new Set(trainingRequirementRows.flatMap(requirement => [requirement.currentDocumentVersionId, requirement.requiredDocumentVersionId]).concat(trainingCompletionRows.map(completion => completion.documentVersionId)).filter((id): id is string => Boolean(id)))];
  const pointerVersions = versionIds.length ? await db.select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.id, versionIds)) : [];
  const versionById = new Map([...currentVersions, ...pointerVersions].map(version => [version.id, version]));
  const documentIds = [...new Set([...currentVersions, ...pointerVersions].map(version => version.documentId).filter((id): id is string => Boolean(id)).concat(additionalCompletionRows.map(completion => completion.documentId).filter((id): id is string => Boolean(id))) )];
  const documentRows = documentIds.length ? await db.select().from(documents).where(inArray(documents.id, documentIds)) : [];
  const documentById = new Map(documentRows.map(document => [document.id, document]));
  const trainingData = trainingRequirementRows.map(requirement => {
    const versions = currentVersions.filter(version => version.requirementId === requirement.id).sort((a, b) => a.versionNumber - b.versionNumber);
    const oldest = versions[0];
    const current = requirement.currentDocumentVersionId ? versionById.get(requirement.currentDocumentVersionId) : undefined;
    const required = requirement.requiredDocumentVersionId ? versionById.get(requirement.requiredDocumentVersionId) : oldest;
    const audience = requirement.audience ?? "all_team";
    const selected = Array.isArray(requirement.selectedTeamMemberIds) ? requirement.selectedTeamMemberIds : [];
    const applicableTeamMemberIds = activeTeamMemberRows.filter(member => audience === "managers_only" ? (member.role ?? "team") === "manager" : audience === "selected_people" ? selected.includes(member.id) : true).map(member => member.id);
    const currentDocument = current?.documentId ? documentById.get(current.documentId) : undefined;
    const currentContent = requirement.currentContentVersionId ? contentVersions.find(version => version.id === requirement.currentContentVersionId) : undefined;
    const requirementValue = serialize(requirement) as Record<string, unknown>;
    delete requirementValue.documentStorageId;
    delete requirementValue.documentName;
    return { ...requirementValue, trainingInstructions: currentContent?.content ?? requirement.description, currentDocumentVersion: documentVersion(current), requiredDocumentVersion: documentVersion(required), currentDocumentVersionNumber: current?.versionNumber, requiredDocumentVersionNumber: required?.versionNumber, currentContentVersionNumber: currentContent?.versionNumber, requiredContentVersionNumber: requirement.requiredContentVersionId ? contentVersions.find(version => version.id === requirement.requiredContentVersionId)?.versionNumber : undefined, applicableTeamMemberIds, documentUrl: requirement.trainingFormat === "document" && currentDocument ? `/api/documents/${currentDocument.id}` : null };
  });
  const trainingDataRows = trainingCompletionRows.map(completion => {
    const version = completion.documentVersionId ? versionById.get(completion.documentVersionId) : undefined;
    const contentVersion = completion.contentVersionId ? contentVersions.find(item => item.id === completion.contentVersionId) : undefined;
    const requirement = trainingRequirementRows.find(item => item.id === completion.requirementId);
    return { id: completion.id, locationId: completion.locationId, requirementId: completion.requirementId, teamMemberId: completion.teamMemberId, completedAt: completion.completedAt.toISOString(), completedBy: completion.completedBy, documentVersion: documentVersion(version), documentVersionNumber: version?.versionNumber, contentVersionId: completion.contentVersionId, contentVersionNumber: contentVersion?.versionNumber, teamMemberName: teamNames.get(completion.teamMemberId), requirementTitle: requirement?.title };
  });
  const additionalData = additionalCompletionRows.map(completion => ({ ...serialize(completion), teamMemberName: teamNames.get(completion.teamMemberId), requirementTitle: additionalRequirementRows.find(requirement => requirement.id === completion.requirementId)?.title, documentUrl: completion.documentId && documentById.has(completion.documentId) ? `/api/documents/${completion.documentId}` : null }));
  const role = roleFor(context, location.id);
  return {
    location: locationDto(location),
    access: { role, memberships: context.memberships },
    equipment: serialize(equipmentRows), tasks: serialize(tasks), rounds: serialize(rounds), readings: serialize(readings), issues: issueData,
    foodChecks: foodRows.map(row => ({ ...serialize(row), teamMemberName: teamNames.get(row.teamMemberId ?? "") })), probeProducts: serialize(probeData),
    security: serialize(security), securityResponses: serialize({ AM: securityData.AM.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId ?? "") })), PM: securityData.PM.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId ?? "") })) }), checklistSignOffs: serialize(checklistSignOffRows.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId) }))), securitySignOffs: serialize(securitySignOffRows.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId) }))),
    wastageItems: serialize(wastageItemRows), wastageRecords: wastageRowRows.map(row => ({ ...serialize(row), teamMemberName: teamNames.get(row.teamMemberId ?? "") })),
    cleaningTasks: serialize(cleaningData), cleaningCompletions: serialize(cleaningCompletionRows.filter(completion => cleaningData.some(task => task.id === completion.taskId)).map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId ?? "") }))),
    teamMembers: serialize(activeTeamMemberRows), trainingRequirements: trainingData, trainingCompletions: trainingDataRows,
    additionalRequirements: serialize(additionalRequirementRows), additionalCompletions: additionalData,
    structuredTasks: serialize(structuredTasks), structuredTaskResponses: serialize(structuredTaskResponseRows),
    checklists: serialize({ opening: { questions: checklists.opening.questions, responses: checklists.opening.responses.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId ?? "") })) }, closing: { questions: checklists.closing.questions, responses: checklists.closing.responses.map(row => ({ ...row, teamMemberName: teamNames.get(row.teamMemberId ?? "") })) } }),
  };
};
