import { ApiError } from "../compliance/errors.js";

export const REPORT_SECTION_KEYS = [
  "temperature_am",
  "temperature_pm",
  "opening_checklist",
  "closing_checklist",
  "security_am",
  "security_pm",
  "food_probes",
  "cleaning",
  "wastage",
  "additional_checks",
] as const;

export type ReportSectionKey = typeof REPORT_SECTION_KEYS[number];

export type ReportDay = {
  date: string;
  status: string;
  complete: boolean;
  correctiveActionRecorded?: boolean;
  cleaningStatus?: "complete" | "incomplete" | "not_required" | "not_verifiable";
  sections?: Partial<Record<ReportSectionKey, boolean | null>>;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isRealDateKey = (value: string) => {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === Number(value.slice(0, 4)) && date.getUTCMonth() + 1 === Number(value.slice(5, 7)) && date.getUTCDate() === Number(value.slice(8, 10));
};

const utcDateKey = (date: Date) => `${date.getUTCFullYear().toString().padStart(4, "0")}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;

export function reportDateRange(start: unknown, end: unknown) {
  if (typeof start !== "string" || !isRealDateKey(start)) throw new ApiError(400, "start must be YYYY-MM-DD");
  if (typeof end !== "string" || !isRealDateKey(end)) throw new ApiError(400, "end must be YYYY-MM-DD");
  if (start > end) throw new ApiError(400, "Date range is invalid");
  const cursor = new Date(`${start}T12:00:00Z`);
  const finish = new Date(`${end}T12:00:00Z`);
  const days: string[] = [];
  while (cursor <= finish) {
    days.push(utcDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (days.length > 366) throw new ApiError(400, "Date range is too large");
  }
  return { start, end, days };
}

export const evaluatedDays = (days: ReportDay[], today: string) => days.filter(day => day.date <= today && day.status !== "grey");

export function sectionCompletion(days: ReportDay[], key: ReportSectionKey, today: string) {
  const evaluated = evaluatedDays(days, today).filter(day => day.sections?.[key] !== null);
  const completedDays = evaluated.filter(day => day.sections?.[key] === true).length;
  const requiredDays = evaluated.length;
  return {
    requiredDays,
    completedDays,
    incompleteDays: Math.max(0, requiredDays - completedDays),
    completionRate: requiredDays ? completedDays / requiredDays : null,
  };
}

export const asOfIssue = (issue: { createdAt: Date; resolvedAt: Date | null; status: string }, end: Date) => issue.createdAt <= end && (!issue.resolvedAt || issue.resolvedAt > end) && issue.status !== "resolved";
