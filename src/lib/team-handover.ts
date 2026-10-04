export type PendingMemberOverrides = Record<string, string>;

export const selectedQuestionMember = (questionId: string, overrides: PendingMemberOverrides, workflowMemberId: string) =>
  overrides[questionId] || workflowMemberId;

export const selectedSignOffMember = (explicitMemberId: string, workflowMemberId: string) =>
  explicitMemberId || workflowMemberId;
