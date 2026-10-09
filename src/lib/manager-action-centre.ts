import { isCleaningTaskComplete } from "@/lib/cleaning-checklist";
import { isItemComplete } from "@/lib/unified-checklist";
import type { DashboardData, StructuredTask } from "@/components/dashboard/dashboard-types";

export type ManagerActionStatus = "complete" | "incomplete" | "not_due" | "due" | "overdue";

export type ManagerActionCentre = {
  required: Array<{
    id: "am" | "pm" | "opening" | "closing" | "security_am" | "security_pm";
    label: string;
    status: ManagerActionStatus;
    detail: string;
  }>;
  failedTemperatures: number;
  unresolvedIssues: number;
  cleaning: { due: number; complete: number; incomplete: number };
  additional: { due: number; complete: number; incomplete: number; overdue: number };
};

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

const statusFor = (complete: boolean): ManagerActionStatus => complete ? "complete" : "incomplete";

const dueTimestamp = (value: string | number) => {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
};

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
  const required = [
    { id: "am" as const, label: "AM temperatures", status: statusFor(source.rounds.some(round => round.session === "AM" && Boolean(round.completedAt))), detail: "Fridge temperature round" },
    { id: "pm" as const, label: "PM temperatures", status: statusFor(source.rounds.some(round => round.session === "PM" && Boolean(round.completedAt))), detail: "Fridge temperature round" },
    { id: "opening" as const, label: "Opening checklist", status: statusFor(areaComplete(source, "opening")), detail: "Required opening checks" },
    { id: "security_am" as const, label: "AM security", status: statusFor(areaComplete(source, "security_am")), detail: "Morning security checks" },
    { id: "closing" as const, label: "Closing checklist", status: statusFor(areaComplete(source, "closing")), detail: "Required closing checks" },
    { id: "security_pm" as const, label: "PM security", status: statusFor(areaComplete(source, "security_pm")), detail: "Evening security checks" },
  ];

  const cleaningTasks = source.structuredTasks.filter(task => task.area === "cleaning");
  const cleaningDue = cleaningTasks.length || source.cleaningTasks.length;
  const cleaningComplete = cleaningTasks.length
    ? cleaningTasks.filter(task => isCleaningTaskComplete(task, source.structuredTaskResponses, source.cleaningCompletions)).length
    : source.cleaningCompletions.length;

  const additionalRequirements = source.additionalRequirements ?? [];
  const additionalCompletions = source.additionalCompletions ?? [];
  const additionalDue = additionalRequirements.filter(requirement => dueTimestamp(requirement.nextDueAt) <= timestamp);
  const additionalDone = additionalDue.filter(requirement => additionalComplete(requirement, additionalCompletions)).length;
  const additionalOverdue = additionalDue.filter(requirement => dueTimestamp(requirement.nextDueAt) < timestamp - 86400000 && !additionalComplete(requirement, additionalCompletions)).length;

  const unresolvedIssueIds = new Set(source.issues.filter(issue => issue.status !== "resolved").map(issue => issue._id));
  const issueByReading = new Set(source.issues.filter(issue => issue.status !== "resolved" && issue.sourceTemperatureReadingId).map(issue => issue.sourceTemperatureReadingId));
  const failedTemperatures = source.readings.filter(reading => reading.result === "fail" && (issueByReading.has(reading._id) || source.issues.every(issue => issue.sourceTemperatureReadingId !== reading._id))).length;

  return {
    required,
    failedTemperatures,
    unresolvedIssues: unresolvedIssueIds.size,
    cleaning: { due: cleaningDue, complete: Math.min(cleaningComplete, cleaningDue), incomplete: Math.max(0, cleaningDue - cleaningComplete) },
    additional: { due: additionalDue.length, complete: additionalDone, incomplete: Math.max(0, additionalDue.length - additionalDone), overdue: additionalOverdue },
  };
}
