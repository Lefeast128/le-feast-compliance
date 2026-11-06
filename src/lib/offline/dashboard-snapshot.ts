import type { DashboardData } from "@/components/dashboard/dashboard-types";
import { readOfflineSession } from "./device-session";
import { storeLocalDateKey } from "@/lib/store-operational-day";

const keyFor = (organisationId: string, userId: string, locationId: string) => `le-feast-offline-dashboard:${organisationId}:${userId}:${locationId}`;

type OpeningSnapshot = Pick<DashboardData, "location" | "access" | "teamMembers" | "checklists" | "checklistSignOffs" | "structuredTasks" | "structuredTaskResponses">;

export function openingSnapshotForDate(snapshot: DashboardData, dateKey: string): DashboardData {
  const isOnDate = (value: string | number | undefined) => {
    if (value == null) return false;
    const timestamp = typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(timestamp) && storeLocalDateKey(timestamp, snapshot.location.timezone ?? "Europe/London") === dateKey;
  };
  return {
    ...snapshot,
    checklists: {
      ...snapshot.checklists,
      opening: { ...snapshot.checklists.opening, responses: snapshot.checklists.opening.responses.filter(response => isOnDate(response.createdAt)) },
    },
    checklistSignOffs: snapshot.checklistSignOffs?.filter(signOff => signOff.dateKey === dateKey),
    structuredTaskResponses: snapshot.structuredTaskResponses.filter(response => response.dateKey === dateKey),
  };
}

export function buildOpeningSnapshot(value: DashboardData): DashboardData {
  return {
    location: value.location,
    access: value.access,
    teamMembers: value.teamMembers,
    equipment: [], readings: [], issues: [], rounds: [],
    checklists: { opening: value.checklists.opening, closing: { questions: [], responses: [] } },
    checklistSignOffs: value.checklistSignOffs,
    security: { AM: [], PM: [] }, securityResponses: { AM: [], PM: [] }, securitySignOffs: [],
    probeProducts: [], foodChecks: [], wastageRecords: [], cleaningTasks: [], cleaningCompletions: [],
    trainingRequirements: [], trainingCompletions: [],
    structuredTasks: value.structuredTasks.filter((task) => task.area === "opening"),
    structuredTaskResponses: value.structuredTaskResponses.filter((response) => response.taskArea === "opening"),
    additionalRequirements: [], additionalCompletions: [],
  };
}

export function writeOpeningSnapshot(value: DashboardData) {
  const session = readOfflineSession();
  if (!session || session.locationId !== value.location._id) return;
  const snapshot: OpeningSnapshot = buildOpeningSnapshot(value);
  try { window.localStorage.setItem(keyFor(session.organisationId, session.userId, session.locationId), JSON.stringify(snapshot)); } catch { /* offline remains available only for the current session */ }
}

export function readOpeningSnapshot(locationId: string): DashboardData | null {
  const session = readOfflineSession();
  if (!session || session.locationId !== locationId || Date.parse(session.expiresAt) <= Date.now()) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(session.organisationId, session.userId, locationId));
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as DashboardData;
    const dateKey = storeLocalDateKey(Date.now(), snapshot.location.timezone ?? "Europe/London");
    return openingSnapshotForDate(snapshot, dateKey);
  } catch { return null; }
}
