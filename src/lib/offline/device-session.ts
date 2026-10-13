import type { AuthUser } from "@/lib/api-client";
import type { OfflineScope, OfflineSession } from "./types";

const SESSION_KEY = "le-feast-offline-session";
export const OFFLINE_SESSION_MAX_MS = 8 * 60 * 60 * 1000;
let memoryDeviceSessionId: string | null = null;

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceSessionId() {
  if (memoryDeviceSessionId) return memoryDeviceSessionId;
  try {
    const existing = window.sessionStorage.getItem("le-feast-device-session");
    if (existing) return (memoryDeviceSessionId = existing);
    const id = randomId();
    window.sessionStorage.setItem("le-feast-device-session", id);
    return (memoryDeviceSessionId = id);
  } catch {
    return (memoryDeviceSessionId = randomId());
  }
}

export function establishOfflineSession(user: AuthUser, locationId: string) {
  const now = Date.now();
  const session: OfflineSession = {
    organisationId: user.organisationId ?? "",
    locationId,
    userId: user.id,
    deviceSessionId: getDeviceSessionId(),
    authenticatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OFFLINE_SESSION_MAX_MS).toISOString(),
  };
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* offline remains disabled if storage is unavailable */ }
  return session;
}

export function readOfflineSession(): OfflineSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as OfflineSession : null;
  } catch { return null; }
}

export function clearOfflineSession() {
  try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* best effort */ }
}

export function sessionCanWrite(session: OfflineSession | null, scope: OfflineScope, now = Date.now()) {
  return Boolean(session && session.organisationId === scope.organisationId && session.locationId === scope.locationId && session.userId === scope.userId && session.deviceSessionId === scope.deviceSessionId && Date.parse(session.expiresAt) > now);
}
