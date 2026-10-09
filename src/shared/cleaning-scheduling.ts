export const CLEANING_WEEKDAYS = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
] as const;

export type CleaningFrequency = "after_use" | "daily" | "weekly" | "specific_days";

export function normalizeCleaningWeekdays(frequency: string, value: unknown) {
  const days = Array.isArray(value)
    ? value.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  // Older weekly records were implicitly Monday schedules. Keep those records
  // valid while every newly configured schedule uses explicit day selection.
  return frequency === "weekly" && days.length === 0 ? [1] : [...new Set(days)].sort((a, b) => a - b);
}

export function cleaningRunsOn(frequency: string, weekdays: unknown, weekday: number) {
  if (frequency === "after_use" || frequency === "daily") return true;
  return normalizeCleaningWeekdays(frequency, weekdays).includes(weekday);
}

export type CleaningEvidenceStatus = "scheduled" | "not_required" | "not_verifiable";

export function localWeekdayForDate(dateKey: string, timeZone: string) {
  const timestamp = Date.parse(`${dateKey}T12:00:00Z`);
  const weekday = new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "short" }).format(new Date(timestamp));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

/**
 * After-use cleaning is operationally triggered by an observed use event.
 * There is no usage record in the current model, so historical reports must
 * keep it visible as not verifiable rather than treating it as missed.
 */
export function cleaningEvidenceStatus(frequency: string, weekdays: unknown, dateKey: string, timeZone: string): CleaningEvidenceStatus {
  if (frequency === "after_use") return "not_verifiable";
  return cleaningRunsOn(frequency, weekdays, localWeekdayForDate(dateKey, timeZone)) ? "scheduled" : "not_required";
}

export function cleaningIsScheduledForDate(frequency: string, weekdays: unknown, dateKey: string, timeZone: string) {
  return cleaningEvidenceStatus(frequency, weekdays, dateKey, timeZone) === "scheduled";
}

export function cleaningWeekdayLabel(value: number) {
  return CLEANING_WEEKDAYS.find(day => day.value === value)?.label ?? `Day ${value}`;
}

export function cleaningWeekdaySummary(frequency: string, weekdays: unknown) {
  if (frequency === "after_use") return "After use";
  if (frequency === "daily") return "Daily";
  const days = normalizeCleaningWeekdays(frequency, weekdays);
  return days.length ? days.map(cleaningWeekdayLabel).join(", ") : "No weekdays selected";
}
