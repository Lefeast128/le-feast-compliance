import type { StructuredTask, StructuredTaskResponse } from "@/components/dashboard/dashboard-types";

export type CleaningCompletionEvidence = {
  taskId: string;
};

const responseMatchesTask = (task: StructuredTask, response: StructuredTaskResponse) =>
  response.taskId === task._id
  || Boolean(
    task.versionRootId
    && task.definitionKey
    && response.taskVersionRootId === task.versionRootId
    && response.taskDefinitionKey === task.definitionKey,
  );

export const requiredCleaningStepIds = (task: StructuredTask) =>
  task.taskType === "with_steps"
    ? (task.steps ?? []).filter((step) => step.required !== false).map((step) => step.id)
    : ["simple"];

export const isCleaningTaskComplete = (
  task: StructuredTask,
  responses: StructuredTaskResponse[],
  completions: CleaningCompletionEvidence[],
) => {
  const requiredSteps = requiredCleaningStepIds(task);
  const structuredComplete = requiredSteps.every((stepId) => responses.some(
    (response) => response.taskArea === "cleaning" && response.stepId === stepId && responseMatchesTask(task, response),
  ));
  const legacyComplete = task.taskType !== "with_steps"
    && task.completionMode === "task"
    && completions.some((completion) => completion.taskId === task._id);
  return structuredComplete || legacyComplete;
};

export const cleaningProgress = (
  tasks: StructuredTask[],
  responses: StructuredTaskResponse[],
  completions: CleaningCompletionEvidence[],
) => ({
  complete: tasks.filter((task) => isCleaningTaskComplete(task, responses, completions)).length,
  total: tasks.length,
});
