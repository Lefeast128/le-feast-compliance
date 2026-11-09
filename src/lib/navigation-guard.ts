export function shouldConfirmAppNavigation(input: {
  activeWorkflow: boolean;
  adminHasUnsavedChanges: boolean;
  submissionInFlight: boolean;
  pendingMutations: number;
}) {
  return input.submissionInFlight || input.pendingMutations > 0 || input.activeWorkflow || input.adminHasUnsavedChanges;
}
