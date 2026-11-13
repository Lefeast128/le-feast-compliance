import { isCleaningTaskComplete } from "./cleaning-checklist.js";
import { isItemComplete } from "./unified-checklist.js";
import { getIssueAttentionTaskIds } from "../components/dashboard/daily-checks-model.js";
import type { DashboardData, StructuredTask } from "../components/dashboard/dashboard-types.js";
import { additionalOccurrenceComplete, localOperationalDate, localOperationalDateFor, scheduledCleaningTasks } from "./manager-action-scheduling.js";

export type ManagerActionStatus = "complete" | "in_progress" | "due_now" | "pending_today" | "not_due" | "overdue";

export type ManagerActionCentre = {
  required: Array<{
    id: "am" | "pm" | "opening" | "closing" | "security_am" | "security_pm";
    label: string;
    status: ManagerActionStatus;
    detail: string;
    taskId: string;
    requiresAttention: boolean;
  }>;
  failedTemperatures: number;
  unresolvedIssues: number;
  cleaning: { due: number; complete: number; incomplete: number; incompleteTaskIds: string[]; issueReported: number; afterUse: number; afterUseComplete: number };
  additional: { due: number; complete: number; incomplete: number; overdue: number; issueReported: number };
  issueLinkedTaskIds: string[];
};

export function countManagerAttention(currentIssueCount: number, reviewDueCount: number, actionCentre: ManagerActionCentre | null) {
  if (!actionCentre) return currentIssueCount + reviewDueCount;
  const required = actionCentre.required.filter(item => item.requiresAttention && !actionCentre.issueLinkedTaskIds.includes(item.taskId)).length;
  const incompleteCleaning = new Set(actionCentre.cleaning.incompleteTaskIds);
  const linkedCleaning = new Set(actionCentre.issueLinkedTaskIds.filter(id => id.startsWith("cleaning:") && incompleteCleaning.has(id.slice("cleaning:".length))));
  const cleaning = Math.max(0, actionCentre.cleaning.incomplete - linkedCleaning.size);
  const additional = actionCentre.additional.incomplete;
  return currentIssueCount + reviewDueCount + required + cleaning + additional;
}

type AdditionalRequirement = {
  _id: string;
  id?: string;
  versionRootId?: string | null;
  nextDueAt: string | number;
};

type AdditionalCompletion = {
  requirementId?: string;
  requirementRootId?: string | null;
  nextDueAt?: string | number | null;
  scheduledDueAt?: string | number | null;
};

type ManagerDashboardData = DashboardData & {
  additionalRequirements?: AdditionalRequirement[];
  additionalCompletions?: AdditionalCompletion[];
};

type CleaningCompletion = DashboardData["cleaningCompletions"][number] & { dateKey?: string };

const hasResponses = (data: ManagerDashboardData, area: StructuredTask["area"]) => {
  const structured = data.structuredTaskResponses.some(response => response.taskArea === area);
  if (area === "opening" || area === "closing") return structured || data.checklists[area].responses.length > 0;
  return structured || data.securityResponses[area === "security_am" ? "AM" : "PM"].length > 0;
};

const signOffRecorded = (data: ManagerDashboardData, area: string) => area === "opening" || area === "closing"
  ? Boolean(data.checklistSignOffs?.some(signOff => signOff.checklist === area))
  : Boolean(data.securitySignOffs?.some(signOff => signOff.session === (area === "security_am" ? "AM" : "PM")));

const areaComplete = (data: ManagerDashboardData, area: StructuredTask["area"]) => {
  const tasks = data.structuredTasks.filter(task => task.area === area);
  const legacy = area === "opening" || area === "closing"
    ? data.checklists[area].responses
    : data.securityResponses[area === "security_am" ? "AM" : "PM"];
  if (!tasks.length) return legacy.length > 0 && signOffRecorded(data, area);
  const responses = data.structuredTaskResponses.filter(response => response.taskArea === area);
  return tasks.every(task => isItemComplete(task, legacy, responses)) && signOffRecorded(data, area);
};

const requiredStatus = (complete: boolean, inProgress: boolean, pendingToday: boolean): ManagerActionStatus => {
  if (complete) return "complete";
  if (inProgress) return "in_progress";
  if (pendingToday) return "pending_today";
  return "due_now";
};

const requiredAttention = (status: ManagerActionStatus) => status === "in_progress" || status === "due_now" || status === "overdue";

export function buildManagerActionCentre(source: ManagerDashboardData, timestamp = Date.now()): ManagerActionCentre {
  const pendingRound = (session: "AM" | "PM") => source.rounds.some(round => round.session === session && !round.completedAt);
  const unresolvedIssues = source.issues.filter(issue => issue.status !== "resolved");
  const issueLinkedTaskIds = getIssueAttentionTaskIds({
    issues: unresolvedIssues,
    temperatureReadings: source.readings,
    temperatureRounds: source.rounds,
    structuredTasks: source.structuredTasks,
  });
  const required = [
    { id: "am" as const, taskId: "am-temperature", label: "AM temperatures", complete: source.rounds.some(round => round.session === "AM" && Boolean(round.completedAt)), inProgress: pendingRound("AM"), pendingToday: false, detail: "Fridge temperature round" },
    { id: "pm" as const, taskId: "pm-temperature", label: "PM temperatures", complete: source.rounds.some(round => round.session === "PM" && Boolean(round.completedAt)), inProgress: pendingRound("PM"), pendingToday: true, detail: "Fridge temperature round" },
    { id: "opening" as const, taskId: "opening-checklist", label: "Opening checklist", complete: areaComplete(source, "opening"), inProgress: hasResponses(source, "opening"), pendingToday: false, detail: "Required opening checks" },
    { id: "security_am" as const, taskId: "am-security", label: "AM security", complete: areaComplete(source, "security_am"), inProgress: hasResponses(source, "security_am"), pendingToday: false, detail: "Morning security checks" },
    { id: "closing" as const, taskId: "closing-checklist", label: "Closing checklist", complete: areaComplete(source, "closing"), inProgress: hasResponses(source, "closing"), pendingToday: true, detail: "Required closing checks" },
    { id: "security_pm" as const, taskId: "pm-security", label: "PM security", complete: areaComplete(source, "security_pm"), inProgress: hasResponses(source, "security_pm"), pendingToday: true, detail: "Evening security checks" },
  ].map(item => {
    const issueReported = issueLinkedTaskIds.includes(item.taskId);
    const status = issueReported ? "in_progress" as const : requiredStatus(item.complete, item.inProgress, item.pendingToday);
    return { ...item, detail: issueReported ? "Issue reported — follow-up required" : item.detail, status, requiresAttention: requiredAttention(status) };
  });

  const cleaningTasks = source.structuredTasks.filter(task => task.area === "cleaning");
  const legacyCleaningTasks = source.cleaningTasks as Array<{ _id: string; name: string; frequency?: string; weekdays?: number[] }>;
  const timeZone = source.location.timezone ?? "Europe/London";
  const today = localOperationalDate(timestamp, timeZone);
  const dueCleaningTasks: Array<{ _id: string; frequency?: string; weekdays?: number[] }> = cleaningTasks.length
    ? scheduledCleaningTasks(cleaningTasks, today, timeZone)
    : scheduledCleaningTasks(legacyCleaningTasks, today, timeZone);
  const afterUseCleaningTasks = cleaningTasks.length
    ? cleaningTasks.filter(task => task.frequency === "after_use")
    : legacyCleaningTasks.filter(task => task.frequency === "after_use");
  const todayResponses = source.structuredTaskResponses.filter(response => response.taskArea !== "cleaning" || response.dateKey === today);
  const todayCompletions = (source.cleaningCompletions as CleaningCompletion[]).filter(completion => {
    if (completion.dateKey) return completion.dateKey === today;
    const completedAt = typeof completion.completedAt === "number" ? completion.completedAt : Date.parse(String(completion.completedAt ?? ""));
    return Number.isFinite(completedAt) && localOperationalDate(completedAt, timeZone) === today;
  });
  const cleaningCompleteFor = (tasks: Array<{ _id: string }>) => cleaningTasks.length
    ? tasks.filter(task => isCleaningTaskComplete(task as StructuredTask, todayResponses, todayCompletions)).length
    : todayCompletions.filter(completion => tasks.some(task => task._id === completion.taskId)).length;
  const cleaningDue = dueCleaningTasks.length;
  const cleaningComplete = cleaningCompleteFor(dueCleaningTasks);
  const afterUseComplete = cleaningCompleteFor(afterUseCleaningTasks);

  const additionalRequirements = source.additionalRequirements ?? [];
  const additionalCompletions = source.additionalCompletions ?? [];
  const additionalDue = additionalRequirements.filter(requirement => localOperationalDateFor(requirement.nextDueAt, timeZone) <= today);
  const additionalDone = additionalDue.filter(requirement => additionalOccurrenceComplete(requirement, additionalCompletions)).length;
  const additionalOverdue = additionalDue.filter(requirement => localOperationalDateFor(requirement.nextDueAt, timeZone) < today && !additionalOccurrenceComplete(requirement, additionalCompletions)).length;

  const unresolvedIssueIds = new Set(unresolvedIssues.map(issue => issue._id));
  const issueByReading = new Set(unresolvedIssues.filter(issue => issue.sourceTemperatureReadingId).map(issue => issue.sourceTemperatureReadingId));
  const failedTemperatures = source.readings.filter(reading => reading.result === "fail" && issueByReading.has(reading._id)).length;

  const incompleteCleaningTasks = dueCleaningTasks.filter(task => !cleaningCompleteFor([task]));
  const allCleaningTaskIds = new Set([...dueCleaningTasks, ...afterUseCleaningTasks].map(task => task._id));
  const issueReportedCleaning = new Set(issueLinkedTaskIds.filter(id => id.startsWith("cleaning:")).map(id => id.slice("cleaning:".length)).filter(id => allCleaningTaskIds.has(id))).size;
  const issueReportedAdditional = new Set(unresolvedIssues.filter(issue => issue.sourceAdditionalCompletionId).map(issue => issue.sourceAdditionalCompletionId)).size;

  return {
    required,
    failedTemperatures,
    unresolvedIssues: unresolvedIssueIds.size,
    cleaning: { due: cleaningDue, complete: Math.min(cleaningComplete, cleaningDue), incomplete: Math.max(0, cleaningDue - cleaningComplete), incompleteTaskIds: incompleteCleaningTasks.map(task => task._id), issueReported: issueReportedCleaning, afterUse: afterUseCleaningTasks.length, afterUseComplete: Math.min(afterUseComplete, afterUseCleaningTasks.length) },
    additional: { due: additionalDue.length, complete: additionalDone, incomplete: Math.max(0, additionalDue.length - additionalDone), overdue: additionalOverdue, issueReported: issueReportedAdditional },
    issueLinkedTaskIds,
  };
}
