import { ApiError } from "../compliance/errors.js";
export const additionalFrequencies = ["weekly", "monthly", "every_x_weeks", "every_x_months", "annual", "one_off"] as const;
export type AdditionalFrequency = typeof additionalFrequencies[number];

export { WEEKDAYS } from "../../shared/additional-scheduling.js";

export type AdditionalSchedule = {
  frequency: AdditionalFrequency;
  interval: number | null;
  weekdays: number[];
  dayOfMonth: number | null;
  nextDueAt: Date;
};

export function weekdayForDate(value: Date) {
  const day = value.getUTCDay();
  return day === 0 ? 7 : day;
}

export function normalizeWeekdays(value: unknown, fallbackDate?: Date) {
  if (value === undefined) return fallbackDate ? [weekdayForDate(fallbackDate)] : [];
  if (!Array.isArray(value)) throw new ApiError(422, "weekdays must be an array");
  const days = value.map(day => typeof day === "number" ? day : Number(day));
  if (days.some(day => !Number.isInteger(day) || day < 1 || day > 7)) throw new ApiError(422, "weekdays must contain values from 1 to 7");
  return [...new Set(days)].sort((a, b) => a - b);
}

function dateWithDay(date: Date, day: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(1);
  next.setUTCDate(day);
  if (next.getUTCDate() !== day) {
    next.setUTCDate(0);
  }
  return next;
}

export function validateAdditionalSchedule(input: {
  frequency: unknown;
  interval?: unknown;
  weekdays?: unknown;
  nextDueAt: Date;
  dayOfMonth?: unknown;
}): AdditionalSchedule {
  if (!additionalFrequencies.includes(input.frequency as AdditionalFrequency)) throw new ApiError(422, "frequency is invalid");
  const frequency = input.frequency as AdditionalFrequency;
  const interval = input.interval === undefined || input.interval === null || input.interval === "" ? null : Number(input.interval);
  if ((frequency === "every_x_weeks" || frequency === "every_x_months") && (!Number.isInteger(interval) || (interval as number) < 1)) {
    throw new ApiError(422, "Interval must be a whole number of at least 1");
  }
  const weekdays = normalizeWeekdays(input.weekdays === null ? undefined : input.weekdays, input.nextDueAt);
  if ((frequency === "weekly" || frequency === "every_x_weeks") && weekdays.length === 0) throw new ApiError(422, "Select at least one weekday");
  let nextDueAt = new Date(input.nextDueAt.getTime());
  let dayOfMonth: number | null = null;
  if (frequency === "monthly" || frequency === "every_x_months") {
    const rawDay = input.dayOfMonth === undefined || input.dayOfMonth === "" ? nextDueAt.getUTCDate() : Number(input.dayOfMonth);
    if (!Number.isInteger(rawDay) || rawDay < 1 || rawDay > 31) throw new ApiError(422, "Day of month must be a whole number from 1 to 31");
    dayOfMonth = rawDay;
    nextDueAt = dateWithDay(nextDueAt, rawDay);
  }
  return { frequency, interval, weekdays, dayOfMonth, nextDueAt };
}

function addMonths(date: Date, months: number, day: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));
  return next;
}

export function nextAdditionalDue(schedule: Pick<AdditionalSchedule, "frequency" | "interval" | "weekdays" | "dayOfMonth">, timestamp: Date) {
  const current = new Date(timestamp.getTime());
  if (schedule.frequency === "one_off") return current;
  if (schedule.frequency === "weekly" || schedule.frequency === "every_x_weeks") {
    const days = schedule.weekdays.length ? schedule.weekdays : [weekdayForDate(current)];
    const minimum = schedule.frequency === "every_x_weeks" ? 7 * (schedule.interval ?? 1) : 1;
    const candidate = new Date(current.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + minimum);
    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(candidate.getTime());
      day.setUTCDate(candidate.getUTCDate() + offset);
      if (days.includes(weekdayForDate(day))) return day;
    }
    return candidate;
  }
  if (schedule.frequency === "annual") {
    return addMonths(current, 12, current.getUTCDate());
  }
  return addMonths(current, schedule.frequency === "every_x_months" ? schedule.interval ?? 1 : 1, schedule.dayOfMonth ?? current.getUTCDate());
}
