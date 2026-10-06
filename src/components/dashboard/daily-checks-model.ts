export type DailyTaskStatus =
  | "not-started"
  | "in-progress"
  | "completed"
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
  hasOpenIssues: boolean;
};

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
  if (complete) return "completed";
  if (attention) return "attention";
  if (dueLater) return "due-later";
  if (inProgress) return "in-progress";
  return "not-started";
}

export function buildDailyTaskModels(input: DailyChecksModelInput): DailyTaskModel[] {
  const requiredAttention = input.hasOpenIssues;
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
        attention: requiredAttention && !input.amComplete,
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
      status: getTaskStatus({ complete: input.openingComplete, attention: requiredAttention && !input.openingComplete }),
      actionLabel: input.openingComplete ? "View checklist" : "Start opening checklist",
      required: true,
    },
    {
      id: "am-security",
      title: "AM security check",
      description: "Complete the morning security questions.",
      detail: input.amSecurityComplete ? "Completed" : "Not completed",
      icon: "security",
      status: getTaskStatus({ complete: input.amSecurityComplete, attention: requiredAttention && !input.amSecurityComplete }),
      actionLabel: input.amSecurityComplete ? "View security check" : "Start AM security",
      required: true,
    },
    {
      id: "food-probes",
      title: "Food probes",
      description: "Record cooking temperatures when required.",
      detail: input.foodProbeCount ? `${input.foodProbeCount} recorded today` : "No readings recorded today",
      icon: "probe",
      status: "not-started",
      actionLabel: "Record food probe",
      required: false,
    },
    {
      id: "cleaning",
      title: "Cleaning jobs",
      description: "Complete today's scheduled cleaning tasks.",
      detail: `${input.cleaningCompleted} of ${input.cleaningDue} due today complete`,
      icon: "cleaning",
      status: getTaskStatus({ complete: input.cleaningDue > 0 && input.cleaningCompleted >= input.cleaningDue }),
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
        ? getTaskStatus({ complete: input.additionalCompleted >= input.additionalDue })
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
      status: getTaskStatus({ complete: input.pmComplete, inProgress: input.pmInProgress, dueLater: !input.pmComplete }),
      actionLabel: input.pmComplete ? "View readings" : "Start PM temperatures",
      required: true,
    },
    {
      id: "closing-checklist",
      title: "Closing checklist",
      description: "Confirm the store is ready to close safely.",
      detail: input.closingComplete ? "All questions and sign-off complete" : "Due later today",
      icon: "checklist",
      status: getTaskStatus({ complete: input.closingComplete, dueLater: !input.closingComplete }),
      actionLabel: input.closingComplete ? "View checklist" : "Start closing checklist",
      required: true,
    },
    {
      id: "pm-security",
      title: "PM security check",
      description: "Complete the evening security questions.",
      detail: input.pmSecurityComplete ? "Completed" : "Due later today",
      icon: "security",
      status: getTaskStatus({ complete: input.pmSecurityComplete, dueLater: !input.pmSecurityComplete }),
      actionLabel: input.pmSecurityComplete ? "View security check" : "Start PM security",
      required: true,
    },
  ];
}
