import { isCleaningTaskComplete } from "@/lib/cleaning-checklist";
import { isItemComplete } from "@/lib/unified-checklist";
import { getIssueAttentionTaskIds } from "@/components/dashboard/daily-checks-model";
import type { DashboardData, StructuredTask } from "@/components/dashboard/dashboard-types";

export type ManagerActionStatus = "complete" | "in_progress" | "due_now" | "due_later" | "not_due" | "overdue";

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
  cleaning: { due: number; complete: number; incomplete: number; afterUse: number; afterUseComplete: number };
  additional: { due: number; complete: number; incomplete: number; overdue: number };
  issueLinkedTaskIds: string[];
};

export function countManagerAttention(currentIssueCount: number, reviewDueCount: number, actionCentre: ManagerActionCentre | null) {
  if (!actionCentre) return currentIssueCount + reviewDueCount;
  const required = actionCentre.required.filter(item => item.requiresAttention && !actionCentre.issueLinkedTaskIds.includes(item.taskId)).length;
  const cleaning = actionCentre.cleaning.incomplete > 0 && !actionCentre.issueLinkedTaskIds.includes("cleaning") ? actionCentre.cleaning.incomplete : 0;
  const additional = actionCentre.additional.incomplete > 0 && !actionCentre.issueLinkedTaskIds.includes("additional-checks") ? actionCentre.additional.incomplete : 0;
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

const itemId = (item: { _id: string; id?: string }) => item._id || item.id || "";

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

const requiredStatus = (complete: boolean, inProgress: boolean, dueLater: boolean): ManagerActionStatus => {
  if (complete) return "complete";
  if (inProgress) return "in_progress";
  if (dueLater) return "due_later";
  return "due_now";
};

const requiredAttention = (status: ManagerActionStatus) => status === "in_progress" || status === "due_now" || status === "overdue";

const dueTimestamp = (value: string | number) => {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

const localDateKey = (timestamp: number, timeZone: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(timestamp));

const additionalComplete = (requirement: AdditionalRequirement, completions: AdditionalCompletion[]) => {
  const root = requirement.versionRootId ?? itemId(requirement);
  const due = dueTimestamp(requirement.nextDueAt);
  return completions.some(completion => {
    const completionRoot = completion.requirementRootId ?? completion.requirementId;
    const completionDue = completion.scheduledDueAt ?? completion.nextDueAt;
    return completionRoot === root && completionDue != null && dueTimestamp(completionDue) === due;
  });
};

export function buildManagerActionCentre(source: ManagerDashboardData, timestamp = Date.now()): ManagerActionCentre {
  const pendingRound = (session: "AM" | "PM") => source.rounds.some(round => round.session === session && !round.completedAt);
  const required = [
    { id: "am" as const, taskId: "am-temperature", label: "AM temperatures", complete: source.rounds.some(round => round.session === "AM" && Boolean(round.completedAt)), inProgress: pendingRound("AM"), dueLater: false, detail: "Fridge temperature round" },
    { id: "pm" as const, taskId: "pm-temperature", label: "PM temperatures", complete: source.rounds.some(round => round.session === "PM" && Boolean(round.completedAt)), inProgress: pendingRound("PM"), dueLater: true, detail: "Fridge temperature round" },
    { id: "opening" as const, taskId: "opening-checklist", label: "Opening checklist", complete: areaComplete(source, "opening"), inProgress: hasResponses(source, "opening"), dueLater: false, detail: "Required opening checks" },
    { id: "security_am" as const, taskId: "am-security", label: "AM security", complete: areaComplete(source, "security_am"), inProgress: hasResponses(source, "security_am"), dueLater: false, detail: "Morning security checks" },
    { id: "closing" as const, taskId: "closing-checklist", label: "Closing checklist", complete: areaComplete(source, "closing"), inProgress: hasResponses(source, "closing"), dueLater: true, detail: "Required closing checks" },
    { id: "security_pm" as const, taskId: "pm-security", label: "PM security", complete: areaComplete(source, "security_pm"), inProgress: hasResponses(source, "security_pm"), dueLater: true, detail: "Evening security checks" },
  ].map(item => {
    const status = requiredStatus(item.complete, item.inProgress, item.dueLater);
    return { ...item, status, requiresAttention: requiredAttention(status) };
  });

  const cleaningTasks = source.structuredTasks.filter(task => task.area === "cleaning");
  const legacyCleaningTasks = source.cleaningTasks as Array<{ _id: string; name: string; frequency?: string }>;
  const configuredCleaningTasks = cleaningTasks.length ? cleaningTasks : legacyCleaningTasks;
  const scheduledCleaningTasks = configuredCleaningTasks.filter(task => task.frequency !== "after_use");
  const afterUseCleaningTasks = configuredCleaningTasks.filter(task => task.frequency === "after_use");
  const cleaningCompleteFor = (tasks: Array<{ _id: string }>) => cleaningTasks.length
    ? tasks.filter(task => isCleaningTaskComplete(task as StructuredTask, source.structuredTaskResponses, source.cleaningCompletions)).length
    : source.cleaningCompletions.filter(completion => tasks.some(task => task._id === completion.taskId)).length;
  const cleaningDue = scheduledCleaningTasks.length;
  const cleaningComplete = cleaningCompleteFor(scheduledCleaningTasks);
  const afterUseComplete = cleaningCompleteFor(afterUseCleaningTasks);

  const additionalRequirements = source.additionalRequirements ?? [];
  const additionalCompletions = source.additionalCompletions ?? [];
  const additionalDue = additionalRequirements.filter(requirement => dueTimestamp(requirement.nextDueAt) <= timestamp);
  const additionalDone = additionalDue.filter(requirement => additionalComplete(requirement, additionalCompletions)).length;
  const timeZone = source.location.timezone ?? "Europe/London";
  const today = localDateKey(timestamp, timeZone);
  const additionalOverdue = additionalDue.filter(requirement => localDateKey(dueTimestamp(requirement.nextDueAt), timeZone) < today && !additionalComplete(requirement, additionalCompletions)).length;

  const unresolvedIssueIds = new Set(source.issues.filter(issue => issue.status !== "resolved").map(issue => issue._id));
  const issueByReading = new Set(source.issues.filter(issue => issue.status !== "resolved" && issue.sourceTemperatureReadingId).map(issue => issue.sourceTemperatureReadingId));
  const failedTemperatures = source.readings.filter(reading => reading.result === "fail" && (issueByReading.has(reading._id) || source.issues.every(issue => issue.sourceTemperatureReadingId !== reading._id))).length;
  const issueLinkedTaskIds = getIssueAttentionTaskIds({
    issues: source.issues.filter(issue => issue.status !== "resolved"),
    temperatureReadings: source.readings,
    temperatureRounds: source.rounds,
    structuredTasks: source.structuredTasks,
  });

  return {
    required,
    failedTemperatures,
    unresolvedIssues: unresolvedIssueIds.size,
    cleaning: { due: cleaningDue, complete: Math.min(cleaningComplete, cleaningDue), incomplete: Math.max(0, cleaningDue - cleaningComplete), afterUse: afterUseCleaningTasks.length, afterUseComplete: Math.min(afterUseComplete, afterUseCleaningTasks.length) },
    additional: { due: additionalDue.length, complete: additionalDone, incomplete: Math.max(0, additionalDue.length - additionalDone), overdue: additionalOverdue },
    issueLinkedTaskIds,
  };
}
