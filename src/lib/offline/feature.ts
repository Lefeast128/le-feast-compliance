export const OFFLINE_OPENING_CHECKLIST_FLAG = "VITE_OFFLINE_OPENING_CHECKLIST";

export function offlineOpeningChecklistEnabled(env?: Record<string, string | undefined>) {
  const values = env ?? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
  return values[OFFLINE_OPENING_CHECKLIST_FLAG] === "true";
}

export function offlineChecklistEnabled(checklist: "opening" | "closing", env?: Record<string, string | undefined>) {
  const values = env ?? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
  return values[`VITE_OFFLINE_${checklist.toUpperCase()}_CHECKLIST`] === "true";
}

export function offlineOperationalWorkflowEnabled(workflow: "cleaning" | "security" | "additional" | "temperature" | "probe" | "issues" | "wastage" | "handover" | "markdown-sheet", env?: Record<string, string | undefined>) {
  const values = env ?? ((import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {});
  return values[`VITE_OFFLINE_${workflow.toUpperCase()}`] === "true";
}
