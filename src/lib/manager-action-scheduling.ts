import { cleaningIsScheduledForDate } from "@/shared/cleaning-scheduling";

export function localOperationalDate(timestamp: number, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function operationalTimestamp(value: string | number) {
  const timestamp = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

export function localOperationalDateFor(value: string | number, timeZone: string) {
  return localOperationalDate(operationalTimestamp(value), timeZone);
}

export function scheduledCleaningTasks<T extends { frequency?: string; weekdays?: unknown }>(
  tasks: T[], dateKey: string, timeZone: string,
) {
  return tasks.filter(task => cleaningIsScheduledForDate(task.frequency ?? "daily", task.weekdays, dateKey, timeZone));
}

export type ScheduledAdditionalRequirement = {
  _id?: string;
  id?: string;
  versionRootId?: string | null;
  nextDueAt: string | number;
};

export type ScheduledAdditionalCompletion = {
  requirementId?: string | null;
  requirementRootId?: string | null;
  nextDueAt?: string | number | null;
  scheduledDueAt?: string | number | null;
};

export function additionalOccurrenceComplete(
  requirement: ScheduledAdditionalRequirement,
  completions: ScheduledAdditionalCompletion[],
) {
  const id = requirement._id ?? requirement.id ?? "";
  const root = requirement.versionRootId ?? id;
  const due = operationalTimestamp(requirement.nextDueAt);
  return completions.some(completion => {
    const completionRoot = completion.requirementRootId ?? completion.requirementId;
    const completionDue = completion.scheduledDueAt ?? completion.nextDueAt;
    return completionRoot === root && completionDue != null && operationalTimestamp(completionDue) === due;
  });
}
