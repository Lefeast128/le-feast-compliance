export type ApiLocation = {
  id: string;
  organisationId: string;
  name: string;
  shortName: string;
  timezone: string;
  active: boolean;
  createdAt: string;
};

export type DashboardResponse = {
  location: ApiLocation;
  access: { role: "admin" | "manager" | "staff"; memberships: Array<{ locationId: string; role: "staff" | "manager" }> };
  equipment: unknown[];
  tasks: unknown[];
  rounds: unknown[];
  readings: unknown[];
  issues: unknown[];
  foodChecks: unknown[];
  probeProducts: unknown[];
  security: { AM: unknown[]; PM: unknown[] };
  securityResponses: { AM: unknown[]; PM: unknown[] };
  checklistSignOffs: unknown[];
  securitySignOffs: unknown[];
  wastageItems: unknown[];
  wastageRecords: unknown[];
  cleaningTasks: unknown[];
  cleaningCompletions: unknown[];
  teamMembers: unknown[];
  trainingRequirements: unknown[];
  trainingCompletions: unknown[];
  additionalRequirements: unknown[];
  additionalCompletions: unknown[];
  checklists: {
    opening: { questions: unknown[]; responses: unknown[] };
    closing: { questions: unknown[]; responses: unknown[] };
  };
};
