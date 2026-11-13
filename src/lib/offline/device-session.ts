import type { AuthMembership, AuthSessionResponse, AuthUser } from "@/lib/api-client";
import type { OfflineScope, OfflineSession } from "./types";

const SESSION_KEY = "le-feast-offline-lease";
const DEVICE_KEY = "le-feast-offline-device";
const SESSION_EVENT = "le-feast:offline-session-changed";
export const OFFLINE_SESSION_MAX_MS = 8 * 60 * 60 * 1000;
let memoryDeviceSessionId: string | null = null;

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getDeviceSessionId() {
  if (memoryDeviceSessionId) return memoryDeviceSessionId;
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return (memoryDeviceSessionId = existing);
    const id = randomId();
    window.localStorage.setItem(DEVICE_KEY, id);
    return (memoryDeviceSessionId = id);
  } catch {
    return (memoryDeviceSessionId = randomId());
  }
}

export function establishOfflineSession(user: AuthUser, locationId: string, memberships: AuthMembership[]) {
  const now = Date.now();
  const session: OfflineSession = {
    organisationId: user.organisationId ?? "",
    locationId,
    userId: user.id,
    deviceSessionId: getDeviceSessionId(),
    authenticatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OFFLINE_SESSION_MAX_MS).toISOString(),
    user,
    memberships,
  };
  try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(session)); window.dispatchEvent(new Event(SESSION_EVENT)); } catch { /* offline remains disabled if storage is unavailable */ }
  return session;
}

export function readOfflineSession(): OfflineSession | null {
  try { const raw = window.localStorage.getItem(SESSION_KEY); return raw ? JSON.parse(raw) as OfflineSession : null; } catch { return null; }
}

export function readOfflineAuthSession(): AuthSessionResponse | null {
  const session = readOfflineSession();
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return { authenticated: true, user: session.user, memberships: session.memberships };
}

export function clearOfflineSession() {
  try { window.localStorage.removeItem(SESSION_KEY); window.dispatchEvent(new Event(SESSION_EVENT)); } catch { /* best effort */ }
}

export { SESSION_EVENT as OFFLINE_SESSION_EVENT };

export function sessionCanWrite(session: OfflineSession | null, scope: OfflineScope, now = Date.now()) {
  return Boolean(session && session.organisationId === scope.organisationId && session.locationId === scope.locationId && session.userId === scope.userId && session.deviceSessionId === scope.deviceSessionId && Date.parse(session.expiresAt) > now);
}
