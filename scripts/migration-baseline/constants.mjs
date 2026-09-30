export const APPLICATION_TABLES = [
  "users",
  "organisations",
  "locations",
  "memberships",
  "teamMembers",
  "scheduledTasks",
  "equipment",
  "temperatureRounds",
  "temperatureReadings",
  "probeProducts",
  "checklistQuestions",
  "checklistResponses",
  "checklistSignOffs",
  "securityQuestions",
  "securityResponses",
  "securitySignOffs",
  "foodChecks",
  "wastageItems",
  "wastageRecords",
  "catalogueProducts",
  "catalogueSyncStatus",
  "cleaningTasks",
  "cleaningCompletions",
  "trainingRequirements",
  "trainingDocumentVersions",
  "trainingCompletions",
  "additionalRequirements",
  "additionalCompletions",
  "rechecks",
  "issues",
  "issueUpdates",
  "auditEvents",
];

export const AUTH_TABLES = [
  "authSessions",
  "authAccounts",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
];

export const ALL_TABLES = [...APPLICATION_TABLES, ...AUTH_TABLES];

export const STORAGE_REFERENCE_SPECS = [
  { table: "trainingRequirements", field: "documentStorageId" },
  { table: "trainingDocumentVersions", field: "storageId" },
  { table: "additionalCompletions", field: "documentStorageId" },
];
