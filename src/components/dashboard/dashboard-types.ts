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
  type?: string;
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

export type DashboardView = "today" | "calendar" | "day" | "admin" | "training" | "additional" | "managerReviews";

export type DashboardIssue = {
  _id: string;
  status: string;
  title: string;
  description: string;
  action?: string | null;
};

export type ChecklistQuestion = {
  _id: string;
  question: string;
};

export type ChecklistResponse = {
  _id?: string;
  questionId: string;
  answer: "yes" | "no" | "na" | string;
};

export type ChecklistState = {
  questions: ChecklistQuestion[];
  responses: ChecklistResponse[];
};

export type SecurityQuestion = ChecklistQuestion;

export type SecurityResponse = {
  _id?: string;
  questionId: string;
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
  cleaningCompletions: Array<{ _id?: string; taskId: string; completedAt?: number; teamMemberName?: string }>;
  trainingRequirements: Array<{ _id: string; title: string }>;
  trainingCompletions: Array<{ _id?: string; requirementId: string; completedAt?: number; teamMemberName?: string }>;
};

export type IssueProgress = {
  actions: string[];
  actionMemberId: string;
  actionsSaved: boolean;
  recheckTemperature: string;
  recheckMemberId: string;
  recheckResult?: string;
  recheckSaved: boolean;
};

export type AdditionalDashboard = {
  requirements: unknown[];
  completions: unknown[];
};
