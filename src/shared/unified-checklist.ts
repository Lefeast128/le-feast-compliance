export type ChecklistDefinitionStep = {
  id: string;
  label?: string;
  description?: string | null;
  responseType: string;
  required?: boolean;
};

export type ChecklistDefinition = {
  id?: string;
  _id?: string;
  versionRootId?: string | null;
  taskType?: string | null;
  completionMode?: string | null;
  steps?: ChecklistDefinitionStep[] | null;
};

export function checklistDefinitionKey(item: ChecklistDefinition) {
  const taskType = item.taskType ?? "simple";
  const completionMode = taskType === "with_steps" ? "question" : item.completionMode ?? "question";
  const steps = taskType === "with_steps"
    ? (item.steps ?? []).map(step => ({
      id: step.id,
      label: step.label ?? "",
      description: step.description ?? null,
      responseType: step.responseType,
      required: step.required !== false,
    }))
    : [];
  return JSON.stringify({ taskType, completionMode, steps });
}

export function checklistVersionRoot(item: ChecklistDefinition) {
  return item.versionRootId ?? item.id ?? item._id ?? null;
}

export function versionedChecklistResponseMatches(
  item: ChecklistDefinition,
  response: { taskId?: string; questionId?: string; taskVersionRootId?: string | null; questionVersionRootId?: string | null; taskDefinitionKey?: string | null; questionDefinitionKey?: string | null },
) {
  const itemId = item.id ?? item._id;
  if (!itemId) return false;
  if (response.taskId === itemId || response.questionId === itemId) return true;
  const responseRoot = response.taskVersionRootId ?? response.questionVersionRootId;
  const responseKey = response.taskDefinitionKey ?? response.questionDefinitionKey;
  return Boolean(responseRoot && responseKey && responseRoot === checklistVersionRoot(item) && responseKey === checklistDefinitionKey(item));
}
