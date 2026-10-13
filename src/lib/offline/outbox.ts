import { ApiError } from "@/lib/api-client";
import { getOfflineStore } from "./indexeddb";
import { readOfflineSession, sessionCanWrite } from "./device-session";
import type { OfflineScope, OfflineSubmission } from "./types";

export const OFFLINE_MAX_ATTEMPTS = 5;
export const OFFLINE_MAX_BACKOFF_MS = 5 * 60 * 1000;

const eventName = "le-feast:offline-outbox-changed";
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(eventName)); };
const id = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `submission-${Date.now()}-${Math.random()}`;
const backoff = (attempts: number) => Math.min(OFFLINE_MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));

export async function enqueueOpeningChecklistResponse(scope: OfflineScope, payload: Record<string, unknown>, store = getOfflineStore()) {
  if (!sessionCanWrite(readOfflineSession(), scope)) throw new ApiError(401, "Sign in again before recording offline checks");
  const now = new Date().toISOString();
  const submission: OfflineSubmission = { ...scope, submissionId: id(), schemaVersion: 1, operation: "opening-checklist-response", endpoint: "/api/compliance/checklists/responses", method: "POST", capturedAt: now, state: "pending", payload, attempts: 0, nextAttemptAt: now, lastError: null, serverResponse: null, createdAt: now, updatedAt: now };
  await store.put(submission); notify(); return submission;
}

export async function syncSubmission(submission: OfflineSubmission, store = getOfflineStore(), transport: typeof fetch = fetch) {
  await store.update(submission.submissionId, { state: "syncing", attempts: submission.attempts + 1 });
  const attempt = submission.attempts + 1;
  try {
    const response = await transport(submission.endpoint, { method: submission.method, credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.submissionId, "X-Offline-Captured-At": submission.capturedAt, "X-Offline-Device-Session": submission.deviceSessionId }, body: JSON.stringify(submission.payload) });
    const text = await response.text();
    let body: unknown = null; try { body = text ? JSON.parse(text) : null; } catch { /* handled below */ }
    if (response.status === 409) { await store.update(submission.submissionId, { state: "conflict", lastError: "The server rejected this submission as a conflict.", serverResponse: body }); notify(); return "conflict" as const; }
    if (response.status === 401 || response.status === 403) { await store.update(submission.submissionId, { state: "failed", lastError: "Authentication or access expired. Sign in again before retrying.", nextAttemptAt: null, serverResponse: body }); notify(); return "failed" as const; }
    if (!response.ok) throw new Error(typeof body === "object" && body && "error" in body ? String((body as { error: unknown }).error) : `HTTP ${response.status}`);
    await store.update(submission.submissionId, { state: "synced", lastError: null, nextAttemptAt: null, serverResponse: body }); notify();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("rest:data-changed"));
    return "synced" as const;
  } catch (error) {
    const nextAttempt = attempt >= OFFLINE_MAX_ATTEMPTS ? null : new Date(Date.now() + backoff(attempt)).toISOString();
    await store.update(submission.submissionId, { state: "failed", attempts: attempt, nextAttemptAt: nextAttempt, lastError: error instanceof Error ? error.message : "Network unavailable" }); notify(); return "failed" as const;
  }
}

export async function syncPending(scope: OfflineScope, store = getOfflineStore(), transport: typeof fetch = fetch) {
  if (!sessionCanWrite(readOfflineSession(), scope)) return { synced: 0, failed: 0, conflicts: 0 };
  const now = Date.now(); const pending = (await store.list(scope, ["pending", "failed"])).filter((item) => !item.nextAttemptAt || Date.parse(item.nextAttemptAt) <= now);
  const result = { synced: 0, failed: 0, conflicts: 0 };
  for (const item of pending) { const status = await syncSubmission(item, store, transport); if (status === "synced") result.synced++; else if (status === "conflict") result.conflicts++; else result.failed++; }
  return result;
}

export function installOutboxRuntime(scopeProvider: () => OfflineScope | null) {
  if (typeof window === "undefined") return () => undefined;
  const sync = () => { const scope = scopeProvider(); if (scope) void syncPending(scope).catch(() => undefined); };
  window.addEventListener("online", sync); window.addEventListener("visibilitychange", sync); sync();
  return () => { window.removeEventListener("online", sync); window.removeEventListener("visibilitychange", sync); };
}

export function subscribeOutbox(listener: () => void) { if (typeof window === "undefined") return () => undefined; window.addEventListener(eventName, listener); return () => window.removeEventListener(eventName, listener); }
