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
