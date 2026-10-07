export type DailyTaskStatus =
  | "not-started"
  | "in-progress"
  | "completed"
  | "completed-attention"
  | "due-later"
  | "attention"
  | "not-scheduled";

export type DailyTaskIcon =
  | "temperature"
  | "probe"
  | "cleaning"
  | "additional"
  | "security"
  | "wastage"
  | "checklist";

export type DailyTaskModel = {
  id: string;
  title: string;
  description: string;
  detail: string;
  icon: DailyTaskIcon;
  status: DailyTaskStatus;
  actionLabel: string;
  required: boolean;
};

const statusLabels: Record<DailyTaskStatus, string> = {
  "not-started": "Ready to start",
  "in-progress": "In progress",
  completed: "Completed",
  "completed-attention": "Completed · Requires attention",
  "due-later": "Due later today",
  attention: "Requires attention",
  "not-scheduled": "Nothing due today",
};

export function dailyTaskStatusLabel(task: Pick<DailyTaskModel, "required" | "status">) {
  if (task.status === "not-scheduled") return "Nothing due today";
  if (task.status === "completed-attention") return "Completed · Requires attention";
  if (!task.required && task.status !== "completed" && task.status !== "attention") return "As needed";
  return statusLabels[task.status];
}

export type DailyChecksModelInput = {
  equipmentCount: number;
  amComplete: boolean;
  pmComplete: boolean;
  amInProgress: boolean;
  pmInProgress: boolean;
  openingComplete: boolean;
  closingComplete: boolean;
  amSecurityComplete: boolean;
  pmSecurityComplete: boolean;
  foodProbeCount: number;
  cleaningCompleted: number;
  cleaningDue: number;
  additionalCompleted: number;
  additionalDue: number;
  wastageCount: number;
  issueAttentionTaskIds: string[];
};

type IssueReference = {
  category?: string | null;
  title?: string | null;
  sourceTemperatureReadingId?: string | null;
  sourceFoodCheckId?: string | null;
  sourceAdditionalCompletionId?: string | null;
};

type TemperatureReadingReference = { _id: string; roundId: string };
type TemperatureRoundReference = { _id: string; session: "AM" | "PM" };
type StructuredTaskReference = { area: string; title: string };

const taskIdForArea = (area: string) => {
  if (area === "opening") return "opening-checklist";
  if (area === "closing") return "closing-checklist";
  if (area === "security_am") return "am-security";
  if (area === "security_pm") return "pm-security";
  if (area === "cleaning") return "cleaning";
  return null;
};

export function getIssueAttentionTaskIds({
  issues,
  temperatureReadings,
  temperatureRounds,
  structuredTasks,
}: {
  issues: IssueReference[];
  temperatureReadings: TemperatureReadingReference[];
  temperatureRounds: TemperatureRoundReference[];
  structuredTasks: StructuredTaskReference[];
}) {
  const roundSessionById = new Map(temperatureRounds.map((round) => [round._id, round.session]));
  const readingRoundById = new Map(temperatureReadings.map((reading) => [reading._id, reading.roundId]));
  const taskIds = new Set<string>();

  for (const issue of issues) {
    if (issue.sourceTemperatureReadingId) {
      const roundId = readingRoundById.get(issue.sourceTemperatureReadingId);
      const session = roundId ? roundSessionById.get(roundId) : undefined;
      if (session) taskIds.add(session === "AM" ? "am-temperature" : "pm-temperature");
      continue;
    }
    if (issue.sourceFoodCheckId) {
      taskIds.add("food-probes");
      continue;
    }
    if (issue.sourceAdditionalCompletionId) {
      taskIds.add("additional-checks");
      continue;
    }

    const title = issue.title?.trim().toLocaleLowerCase() ?? "";
    if (title.startsWith("opening checklist:")) {
      taskIds.add("opening-checklist");
      continue;
    }
    if (title.startsWith("closing checklist:")) {
      taskIds.add("closing-checklist");
      continue;
    }

    if (issue.category?.toLocaleLowerCase() === "operational task") {
      const matchingTask = structuredTasks.find((task) =>
        title.startsWith(`${task.title.trim().toLocaleLowerCase()}:`),
      );
      const taskId = matchingTask ? taskIdForArea(matchingTask.area) : null;
      if (taskId) taskIds.add(taskId);
    }
  }

  return [...taskIds];
}

export function getProgressPercent(completed: number, total: number) {
  if (total <= 0) return 100;
  return Math.round((Math.max(0, Math.min(completed, total)) / total) * 100);
}

export function getProgressMessage(completed: number, total: number) {
  if (completed >= total && total > 0) return "Today's required checks are complete.";
  if (completed > 0) return "Good progress — keep going.";
  return "Let's get today's checks sorted.";
}

export function getTaskStatus({
  complete,
  inProgress = false,
  dueLater = false,
  attention = false,
}: {
  complete: boolean;
  inProgress?: boolean;
  dueLater?: boolean;
  attention?: boolean;
}): DailyTaskStatus {
  if (complete && attention) return "completed-attention";
  if (complete) return "completed";
  if (attention) return "attention";
  if (dueLater) return "due-later";
  if (inProgress) return "in-progress";
  return "not-started";
}

export function buildDailyTaskModels(input: DailyChecksModelInput): DailyTaskModel[] {
  const issueAttention = (taskId: string) => input.issueAttentionTaskIds.includes(taskId);
  return [
    {
      id: "am-temperature",
      title: "Fridge temperatures",
      description: "Record temperatures for every fridge.",
      detail: input.amComplete
        ? `${input.equipmentCount} of ${input.equipmentCount} recorded`
        : `0 of ${input.equipmentCount || 4} recorded`,
      icon: "temperature",
      status: getTaskStatus({
        complete: input.amComplete,
        inProgress: input.amInProgress,
        attention: issueAttention("am-temperature"),
      }),
      actionLabel: input.amComplete ? "View readings" : "Start AM temperatures",
      required: true,
    },
    {
      id: "opening-checklist",
      title: "Opening checklist",
      description: "Confirm the store is ready to open safely.",
      detail: input.openingComplete ? "All questions and sign-off complete" : "Questions still to complete",
      icon: "checklist",
      status: getTaskStatus({ complete: input.openingComplete, attention: issueAttention("opening-checklist") }),
      actionLabel: input.openingComplete ? "View checklist" : "Start opening checklist",
      required: true,
    },
    {
      id: "am-security",
      title: "AM security check",
      description: "Complete the morning security questions.",
      detail: input.amSecurityComplete ? "Completed" : "Not completed",
      icon: "security",
      status: getTaskStatus({ complete: input.amSecurityComplete, attention: issueAttention("am-security") }),
      actionLabel: input.amSecurityComplete ? "View security check" : "Start AM security",
      required: true,
    },
    {
      id: "food-probes",
      title: "Food probes",
      description: "Record cooking temperatures when required.",
      detail: input.foodProbeCount ? `${input.foodProbeCount} recorded today` : "No readings recorded today",
      icon: "probe",
      status: issueAttention("food-probes") ? getTaskStatus({ complete: false, attention: true }) : "not-started",
      actionLabel: "Record food probe",
      required: false,
    },
    {
      id: "cleaning",
      title: "Cleaning jobs",
      description: "Complete today's scheduled cleaning tasks.",
      detail: input.cleaningDue ? `${input.cleaningCompleted} of ${input.cleaningDue} due today complete` : "Nothing due today",
      icon: "cleaning",
      status: input.cleaningDue > 0
        ? getTaskStatus({ complete: input.cleaningCompleted >= input.cleaningDue, attention: issueAttention("cleaning") })
        : issueAttention("cleaning")
          ? getTaskStatus({ complete: false, attention: true })
          : "not-scheduled",
      actionLabel: "Open cleaning jobs",
      required: false,
    },
    {
      id: "additional-checks",
      title: "Additional checks",
      description: "Complete recurring checks due today.",
      detail: input.additionalDue ? `${input.additionalCompleted} of ${input.additionalDue} complete` : "Nothing due today",
      icon: "additional",
      status: input.additionalDue
        ? getTaskStatus({ complete: input.additionalCompleted >= input.additionalDue, attention: issueAttention("additional-checks") })
        : issueAttention("additional-checks")
          ? getTaskStatus({ complete: false, attention: true })
          : "not-scheduled",
      actionLabel: "Open additional checks",
      required: false,
    },
    {
      id: "wastage",
      title: "Wastage",
      description: "Record today's food wastage or confirm no waste.",
      detail: input.wastageCount ? `${input.wastageCount} records today` : "No records today",
      icon: "wastage",
      status: "not-started",
      actionLabel: "Record wastage",
      required: false,
    },
    {
      id: "pm-temperature",
      title: "PM fridge temperatures",
      description: "Record the evening temperature round.",
      detail: input.pmComplete ? `${input.equipmentCount} of ${input.equipmentCount} recorded` : "Due later today",
      icon: "temperature",
      status: getTaskStatus({ complete: input.pmComplete, inProgress: input.pmInProgress, dueLater: !input.pmComplete, attention: issueAttention("pm-temperature") }),
      actionLabel: input.pmComplete ? "View readings" : "Start PM temperatures",
      required: true,
    },
    {
      id: "closing-checklist",
      title: "Closing checklist",
      description: "Confirm the store is ready to close safely.",
      detail: input.closingComplete ? "All questions and sign-off complete" : "Due later today",
      icon: "checklist",
      status: getTaskStatus({ complete: input.closingComplete, dueLater: !input.closingComplete, attention: issueAttention("closing-checklist") }),
      actionLabel: input.closingComplete ? "View checklist" : "Start closing checklist",
      required: true,
    },
    {
      id: "pm-security",
      title: "PM security check",
      description: "Complete the evening security questions.",
      detail: input.pmSecurityComplete ? "Completed" : "Due later today",
      icon: "security",
      status: getTaskStatus({ complete: input.pmSecurityComplete, dueLater: !input.pmSecurityComplete, attention: issueAttention("pm-security") }),
      actionLabel: input.pmSecurityComplete ? "View security check" : "Start PM security",
      required: true,
    },
  ];
}
