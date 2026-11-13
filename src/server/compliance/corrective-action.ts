import { localDateKey } from "./validation.js";

const correctiveActionUpdateTypes = new Set(["immediate_action", "action", "further_action"]);

const hasText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

export function isCorrectiveActionUpdate(update: { updateType?: unknown; note?: unknown }) {
  return typeof update.updateType === "string" && correctiveActionUpdateTypes.has(update.updateType) && hasText(update.note);
}

export function hasCorrectiveActionEvidence(input: {
  action?: unknown;
  responseAction?: unknown;
  updates?: Iterable<{ updateType?: unknown; note?: unknown }>;
}) {
  return hasText(input.action)
    || hasText(input.responseAction)
    || [...(input.updates ?? [])].some(isCorrectiveActionUpdate);
}

function timestampIsOnDate(value: unknown, date: string, timezone: string) {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "string" || typeof value === "number" ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) && localDateKey(timestamp, timezone) === date;
}

export function hasCorrectiveActionOnDay(input: {
  date: string;
  timezone: string;
  updates?: Iterable<{ createdAt?: unknown; updateType?: unknown; note?: unknown }>;
  checklistResponses?: Iterable<{ createdAt?: unknown; action?: unknown }>;
  probes?: Iterable<{ createdAt?: unknown; action?: unknown }>;
}) {
  return [...(input.updates ?? [])].some(update => timestampIsOnDate(update.createdAt, input.date, input.timezone) && isCorrectiveActionUpdate(update))
    || [...(input.checklistResponses ?? [])].some(response => timestampIsOnDate(response.createdAt, input.date, input.timezone) && hasText(response.action))
    || [...(input.probes ?? [])].some(probe => timestampIsOnDate(probe.createdAt, input.date, input.timezone) && hasText(probe.action));
}
