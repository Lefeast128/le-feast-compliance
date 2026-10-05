export type AdminLocation = {
  _id: string;
  name: string;
  organisationId: string;
};

export type AdminOperation = {
  location: AdminLocation;
};

export type AdminQuestion = {
  _id: string;
  question: string;
  checklist?: "opening" | "closing";
  centralItemId?: string | null;
};

export type AdminIssue = {
  _id: string;
  title: string;
  status: string;
  createdAt: number;
};

export type AdminCleaningTask = {
  _id: string;
  name: string;
  frequency: "after_use" | "daily" | "weekly" | "specific_days" | string;
  weekdays: number[];
};

export type AdminProbeProduct = {
  _id: string;
  name: string;
  minimumTemperature: number;
  holdMinutes: number;
};

export type AdminWastageItem = {
  _id: string;
  name: string;
};

export type AdminSecurityQuestion = {
  _id: string;
  question: string;
  session: "AM" | "PM";
};

export type AdminTrainingRequirement = {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  audience?: string;
  documentStorageId?: string | null;
  centralPublicationId?: string | null;
};

export type AdminEquipment = {
  _id: string;
  minimumTemperature?: number;
  preferredTemperature?: number;
  maximumTemperature?: number;
};

export type AdminStore = {
  location: AdminLocation;
  checklists: {
    opening: { questions: AdminQuestion[] };
    closing: { questions: AdminQuestion[] };
  };
  issues: AdminIssue[];
  cleaningTasks: AdminCleaningTask[];
  probeProducts: AdminProbeProduct[];
  wastageItems: AdminWastageItem[];
  security: { AM: AdminSecurityQuestion[]; PM: AdminSecurityQuestion[] };
  trainingRequirements: AdminTrainingRequirement[];
  equipment: AdminEquipment[];
};

export type AdminTeamMember = {
  _id: string;
  name: string;
  role?: "team" | "manager" | string;
};

export type AdminTeamResponse = {
  members: AdminTeamMember[];
};

export type AdminEditor = {
  kind: "cleaning" | "question" | "wastage" | "product" | "security" | "training";
  item?: AdminCleaningTask | AdminQuestion | AdminWastageItem | AdminProbeProduct | AdminSecurityQuestion | AdminTrainingRequirement;
  session?: "AM" | "PM" | "opening" | "closing";
};

export type FridgeEditorState = {
  kind: "count" | "limits";
  item?: AdminEquipment;
};

export type AdminTeamEditorMember = AdminTeamMember | true;

export type AdminEditorValues = {
  name?: string;
  question?: string;
  frequency?: string;
  weekdays?: number[];
  minimumTemperature?: number;
  holdMinutes?: number;
  session?: "AM" | "PM";
  description?: string;
  category?: string;
  audience?: string;
  selectedTeamMemberIds?: string[];
  documentFile?: File | null;
  requireReacknowledgement?: boolean;
};

export type FridgeEditorValues = {
  count?: string;
  minimum?: string;
  preferred?: string;
  maximum?: string;
};
