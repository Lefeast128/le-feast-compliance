export const OFFLINE_OPENING_CHECKLIST_FLAG = "VITE_OFFLINE_OPENING_CHECKLIST";

export function offlineOpeningChecklistEnabled(env?: Record<string, string | undefined>) {
  const values = env ?? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
  return values[OFFLINE_OPENING_CHECKLIST_FLAG] === "true";
}
