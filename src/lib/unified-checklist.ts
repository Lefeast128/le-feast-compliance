import type { StructuredStep } from "@/components/dashboard/dashboard-types";
import { versionedChecklistResponseMatches } from "@/shared/unified-checklist";

export type UnifiedMode = "question" | "task";

export type UnifiedItem = {
  _id: string;
  versionRootId?: string | null;
  definitionKey?: string | null;
  taskType?: "simple" | "with_steps";
  completionMode?: UnifiedMode;
  steps?: StructuredStep[];
};

export type LegacyCompletion = { questionId: string; questionVersionRootId?: string | null; questionDefinitionKey?: string | null };
export type StructuredCompletion = { taskId: string; stepId: string; taskVersionRootId?: string | null; taskDefinitionKey?: string | null };

export const isSimpleCompletionTask = (item: UnifiedItem) =>
  item.taskType !== "with_steps" && item.completionMode === "task";

export const requiredStepIds = (item: UnifiedItem) =>
  (item.steps ?? []).filter((step) => step.required !== false).map((step) => step.id);

export function isItemComplete(
  item: UnifiedItem,
  legacy: LegacyCompletion[],
  structured: StructuredCompletion[],
) {
  if (item.taskType === "with_steps") {
    const responses = new Set(structured.filter((response) => versionedChecklistResponseMatches(item, response)).map((response) => response.stepId));
    return requiredStepIds(item).every((stepId) => responses.has(stepId));
  }
  return structured.some((response) => response.stepId === "simple" && versionedChecklistResponseMatches(item, response))
    || (item.completionMode !== "task" && legacy.some((response) => versionedChecklistResponseMatches(item, response)));
}

export const eligibleSimpleTaskIds = (
  items: UnifiedItem[],
  legacy: LegacyCompletion[],
  structured: StructuredCompletion[],
) => items.filter((item) => isSimpleCompletionTask(item) && !isItemComplete(item, legacy, structured)).map((item) => item._id);

export function buildBulkCompletionPlan(
  items: UnifiedItem[],
  selectedIds: string[],
  defaultMemberId: string,
  overrides: Record<string, string> = {},
  legacy: LegacyCompletion[] = [],
  structured: StructuredCompletion[] = [],
) {
  const selected = new Set(selectedIds);
  return items
    .filter((item) => selected.has(item._id) && isSimpleCompletionTask(item) && !isItemComplete(item, legacy, structured))
    .map((item) => ({ taskId: item._id, teamMemberId: overrides[item._id] || defaultMemberId }));
}

export function checklistProgress(
  items: UnifiedItem[],
  legacy: LegacyCompletion[],
  structured: StructuredCompletion[],
) {
  const complete = items.filter((item) => isItemComplete(item, legacy, structured)).length;
  return { complete, total: items.length, allComplete: items.length > 0 && complete === items.length };
}
