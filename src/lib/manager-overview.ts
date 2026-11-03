import type { ManagerActionCentre, ManagerActionStatus } from "@/lib/manager-action-centre";
import { additionalOccurrenceComplete, localOperationalDate, localOperationalDateFor } from "@/lib/manager-action-scheduling";

export type ManagerOverviewSection = "overview" | "issues" | "reviews" | "history";
export type ManagerOverviewTarget =
  | { kind: "required"; taskId: "am" | "pm" | "opening" | "closing" | "security_am" | "security_pm" }
  | { kind: "cleaning"; taskId: string }
  | { kind: "additional"; requirementId: string }
  | { kind: "review"; reviewType: "weekly" | "four_weekly" };

export type ManagerOverviewIssue = {
  id: string;
  title: string;
  status: string;
  category?: string | null;
  description?: string | null;
  originalReading?: string | null;
  createdAt?: string | null;
  createdByName?: string | null;
  teamMemberName?: string | null;
  latestAction?: string | null;
};

export type ManagerOverviewAction = {
  id: string;
  title: string;
  status: ManagerActionStatus | "open" | "monitoring" | "due";
  detail: string;
  actor?: string | null;
  kind: "issue" | "task" | "review";
  target?: ManagerOverviewTarget;
  issueId?: string;
  priority: 0 | 1 | 2;
};

type ReviewPeriod = { status: string; start?: string | null; end?: string | null };
type CleaningTask = { _id: string; name?: string; title?: string; area?: string };
type AdditionalRequirement = { _id: string; title: string; nextDueAt: string | number };
type AdditionalCompletion = {
  requirementId?: string;
  requirementRootId?: string | null;
  nextDueAt?: string | number | null;
  scheduledDueAt?: string | number | null;
};

const isFailure = (issue: ManagerOverviewIssue) =>
  /temperature|probe|food safety|unsafe|failure|failed/i.test(`${issue.category ?? ""} ${issue.title}`) || Boolean(issue.originalReading);

export function buildManagerOverviewActions(input: {
  issues: ManagerOverviewIssue[];
  centre: ManagerActionCentre;
  cleaningTasks: CleaningTask[];
  additionalRequirements: AdditionalRequirement[];
  additionalCompletions: AdditionalCompletion[];
  timezone: string;
  weekly: ReviewPeriod;
  fourWeekly: ReviewPeriod;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const issues = input.issues.filter(issue => issue.status !== "resolved");
  const issueActions: ManagerOverviewAction[] = issues.map((issue): ManagerOverviewAction => ({
    id: `issue:${issue.id}`,
    title: issue.title,
    status: issue.status === "monitoring" ? "monitoring" : "open",
    detail: issue.latestAction || issue.description || issue.category || "Follow-up required",
    actor: issue.teamMemberName || issue.createdByName,
    kind: "issue",
    issueId: issue.id,
    priority: 0,
  })).sort((a, b) => {
    const issueA = input.issues.find(issue => `issue:${issue.id}` === a.id)!;
    const issueB = input.issues.find(issue => `issue:${issue.id}` === b.id)!;
    return Number(isFailure(issueB)) - Number(isFailure(issueA)) || a.title.localeCompare(b.title);
  });

  const incompleteLinkedCleaning = new Set(input.centre.issueLinkedTaskIds
    .filter(id => id.startsWith("cleaning:"))
    .map(id => id.slice("cleaning:".length)));
  const required = input.centre.required
    .filter(item => item.requiresAttention && !input.centre.issueLinkedTaskIds.includes(item.taskId))
    .map(item => ({
      id: `required:${item.id}`,
      title: item.label,
      status: item.status,
      detail: item.detail,
      kind: "task" as const,
      target: { kind: "required" as const, taskId: item.id },
      priority: 1 as const,
    }));

  const cleaningById = new Map(input.cleaningTasks.map(task => [task._id, task]));
  const cleaning = input.centre.cleaning.incompleteTaskIds
    .filter(id => !incompleteLinkedCleaning.has(id))
    .map(id => {
      const task = cleaningById.get(id);
      return {
        id: `cleaning:${id}`,
        title: task?.title ?? task?.name ?? "Cleaning task",
        status: "due_now" as const,
        detail: "Scheduled today · not yet recorded",
        kind: "task" as const,
        target: { kind: "cleaning" as const, taskId: id },
        priority: 1 as const,
      };
    });

  const today = localOperationalDate(now, input.timezone);
  const additional = input.additionalRequirements
    .filter(requirement => localOperationalDateFor(requirement.nextDueAt, input.timezone) <= today)
    .filter(requirement => !additionalOccurrenceComplete(requirement, input.additionalCompletions))
    .map(requirement => {
      const overdue = localOperationalDateFor(requirement.nextDueAt, input.timezone) < today;
      return {
        id: `additional:${requirement._id}`,
        title: requirement.title,
        status: overdue ? "overdue" as const : "due_now" as const,
        detail: overdue ? `Overdue · due ${localOperationalDateFor(requirement.nextDueAt, input.timezone)}` : "Due today · not yet completed",
        kind: "task" as const,
        target: { kind: "additional" as const, requirementId: requirement._id },
        priority: overdue ? 0 as const : 1 as const,
      };
    });

  const reviewActions: ManagerOverviewAction[] = [
    { type: "weekly" as const, period: input.weekly },
    { type: "four_weekly" as const, period: input.fourWeekly },
  ].filter(item => item.period.status === "due" || item.period.status === "overdue").map(item => ({
    id: `review:${item.type}`,
    title: item.type === "weekly" ? "Weekly review" : "4-week review",
    status: item.period.status === "overdue" ? "overdue" : "due",
    detail: item.period.start && item.period.end ? `Due · ${item.period.start}–${item.period.end}` : "Due for completion",
    kind: "review",
    target: { kind: "review", reviewType: item.type },
    priority: 2,
  }));

  const actions: ManagerOverviewAction[] = [...issueActions, ...additional.filter(item => item.status === "overdue"), ...required, ...cleaning, ...additional.filter(item => item.status !== "overdue"), ...reviewActions];
  const issueLinkedRequired = input.centre.required.filter(item => item.requiresAttention && input.centre.issueLinkedTaskIds.includes(item.taskId)).length;
  const issueLinkedCleaning = input.centre.cleaning.incompleteTaskIds.filter(id => incompleteLinkedCleaning.has(id)).length;
  return {
    actions,
    dueLater: input.centre.required.filter(item => item.status === "pending_today"),
    summary: {
      checksOutstanding: Math.max(0, input.centre.required.filter(item => item.requiresAttention).length - issueLinkedRequired),
      unresolvedIssues: issues.length,
      cleaningOutstanding: Math.max(0, input.centre.cleaning.incomplete - issueLinkedCleaning),
      reviewsDue: reviewActions.length,
    },
  };
}
