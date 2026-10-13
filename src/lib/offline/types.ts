export const OFFLINE_SCHEMA_VERSION = 1;

export type OfflineSubmissionState =
  | "draft"
  | "pending"
  | "syncing"
  | "synced"
  | "failed"
  | "conflict";

export type OfflineScope = {
  organisationId: string;
  locationId: string;
  userId: string;
  deviceSessionId: string;
};

export type OfflineSubmission = OfflineScope & {
  submissionId: string;
  schemaVersion: number;
  operation: "opening-checklist-response";
  endpoint: string;
  method: "POST";
  capturedAt: string;
  state: OfflineSubmissionState;
  payload: Record<string, unknown>;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  serverResponse: unknown;
  createdAt: string;
  updatedAt: string;
};

export type OfflineSession = OfflineScope & {
  authenticatedAt: string;
  expiresAt: string;
};
