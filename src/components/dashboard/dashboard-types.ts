export type DashboardLocation = {
  _id: string;
  name: string;
  organisationId?: string;
};

export type TeamMember = {
  _id: string;
  name: string;
};

export type Equipment = {
  _id: string;
  name?: string;
  type?: string;
  minimumTemperature?: number;
  preferredTemperature?: number;
  maximumTemperature?: number;
};

export type ProbeProduct = {
  _id: string;
  name: string;
  minimumTemperature?: number;
  holdMinutes?: number;
};

export type CalendarDay = {
  date: string;
  status: string;
};

export type DashboardView = "today" | "calendar" | "day" | "admin" | "training" | "library" | "additional" | "managerReviews";

export type ManagerReviewPeriodStatus = {
  status: "complete" | "due" | "overdue" | "up_to_date";
  daysUntilDue: number;
  start: string | null;
  end: string | null;
  available: boolean;
  nextAvailableAfter: string | null;
  completed: boolean;
};

export type ManagerReviewStatus = {
  periods: {
    weekly: ManagerReviewPeriodStatus;
    four_weekly: ManagerReviewPeriodStatus;
  };
};

export type DashboardIssue = {
  _id: string;
  status: string;
  title: string;
  description: string;
  action?: string | null;
  category?: string | null;
  sourceTemperatureReadingId?: string | null;
  sourceFoodCheckId?: string | null;
  sourceAdditionalCompletionId?: string | null;
  updates?: Array<{
    updateType?: string;
    note?: string;
    status?: string;
    createdAt?: string | number;
    teamMemberId?: string | null;
    teamMemberName?: string | null;
  }>;
};

export type ChecklistQuestion = {
  _id: string;
  question: string;
  description?: string | null;
  versionRootId?: string | null;
  definitionKey?: string | null;
  taskType?: "simple" | "with_steps";
  completionMode?: "question" | "task";
  steps?: StructuredStep[];
};

export type StructuredStep = {
  id: string;
  label: string;
  description?: string | null;
  responseType: "confirm" | "yes_no" | "number" | "short_text";
  required?: boolean;
};

export type StructuredTask = {
  _id: string;
  id?: string;
  locationId?: string;
  area: "opening" | "closing" | "cleaning" | "security_am" | "security_pm";
  title: string;
  description?: string | null;
  taskType?: "simple" | "with_steps";
  completionMode?: "question" | "task";
  versionRootId?: string | null;
  definitionKey?: string | null;
  steps?: StructuredStep[];
  centralItemId?: string | null;
  frequency?: string;
  weekdays?: number[];
  order?: number;
};

export type StructuredTaskResponse = {
  _id: string;
  taskArea: string;
  taskId: string;
  stepId: string;
  responseType: string;
  responseValue: string;
  dateKey: string;
  createdAt?: string;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  taskVersionRootId?: string | null;
  taskDefinitionKey?: string | null;
};

export type ChecklistResponse = {
  _id?: string;
  questionId: string;
  answer: "yes" | "no" | "na" | string;
  action?: string | null;
  problem?: string | null;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  createdAt?: number | string;
  questionVersionRootId?: string | null;
  questionDefinitionKey?: string | null;
};

export type ChecklistState = {
  questions: ChecklistQuestion[];
  responses: ChecklistResponse[];
};

export type SecurityQuestion = ChecklistQuestion;

export type SecurityResponse = {
  _id?: string;
  questionId: string;
  answer?: string;
  issue?: string | null;
  createdAt?: string | number;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
};

export type SignOff = {
  checklist?: "opening" | "closing";
  session?: "AM" | "PM";
  teamMemberId?: string;
  teamMemberName?: string;
  completedAt?: number;
};

export type TemperatureRound = {
  _id: string;
  session: "AM" | "PM";
  completedAt?: number;
  startedAt?: number;
  teamMemberId?: string;
};

export type TemperatureReading = {
  _id: string;
  roundId: string;
  equipmentId?: string;
  equipmentName?: string | null;
  result: string;
  temperature: number;
  createdAt?: string | number;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
};

export type FoodCheck = {
  _id: string;
  product: string;
  quantity?: string;
  temperature: number;
  result: string;
  teamMemberName?: string;
  createdAt: number;
};

export type WastageRecord = {
  _id: string;
  noWaste: boolean;
  itemName?: string;
  quantity?: number | string;
  teamMemberName?: string;
  createdAt: number;
};

export type DashboardData = {
  location: DashboardLocation;
  access?: { role: "admin" | "manager" | "staff" };
  teamMembers: TeamMember[];
  equipment: Equipment[];
  readings: TemperatureReading[];
  issues: DashboardIssue[];
  rounds: TemperatureRound[];
  checklists: { opening: ChecklistState; closing: ChecklistState };
  checklistSignOffs?: SignOff[];
  security: { AM: SecurityQuestion[]; PM: SecurityQuestion[] };
  securityResponses: { AM: SecurityResponse[]; PM: SecurityResponse[] };
  securitySignOffs?: SignOff[];
  probeProducts: ProbeProduct[];
  foodChecks: FoodCheck[];
  wastageRecords: WastageRecord[];
  cleaningTasks: Array<{ _id: string; name: string }>;
  cleaningCompletions: Array<{ _id?: string; taskId: string; completedAt?: number | string; teamMemberId?: string | null; teamMemberName?: string }>;
  trainingRequirements: Array<{ _id: string; title: string }>;
  trainingCompletions: Array<{ _id?: string; requirementId: string; completedAt?: number; teamMemberName?: string }>;
  structuredTasks: StructuredTask[];
  structuredTaskResponses: StructuredTaskResponse[];
  additionalRequirements?: Array<{
    _id: string;
    id?: string;
    versionRootId?: string | null;
    nextDueAt: string | number;
  }>;
  additionalCompletions?: Array<{
    requirementId?: string;
    requirementRootId?: string | null;
    nextDueAt?: string | number | null;
    scheduledDueAt?: string | number | null;
  }>;
};

export type IssueProgress = {
  action: string;
  note: string;
  actionMemberId: string;
  actionsSaved: boolean;
};

export type AdditionalDashboard = {
  requirements: unknown[];
  completions: unknown[];
};
