import assert from "node:assert/strict";

const { createMemoryOfflineStore } = await import("../src/lib/offline/indexeddb.ts");
const { syncSubmission, OFFLINE_MAX_ATTEMPTS } = await import("../src/lib/offline/outbox.ts");
const { establishOfflineSession, readOfflineAuthSession, sessionCanWrite, clearOfflineSession } = await import("../src/lib/offline/device-session.ts");
const { offlineOpeningChecklistEnabled } = await import("../src/lib/offline/feature.ts");

const scope = { organisationId: "org-a", locationId: "site-a", userId: "user-a", deviceSessionId: "device-a" };
const now = new Date().toISOString();
const submission = { ...scope, submissionId: "submission-00000001", schemaVersion: 1, operation: "opening-checklist-response", endpoint: "/api/compliance/checklists/responses", method: "POST", capturedAt: now, state: "pending", payload: { locationId: scope.locationId, checklist: "opening", answer: "yes" }, attempts: 0, nextAttemptAt: now, lastError: null, serverResponse: null, createdAt: now, updatedAt: now };

assert.equal(offlineOpeningChecklistEnabled({}), false, "pilot is disabled by default");
assert.equal(offlineOpeningChecklistEnabled({ VITE_OFFLINE_OPENING_CHECKLIST: "true" }), true, "pilot can be explicitly enabled");
assert.equal(sessionCanWrite({ ...scope, authenticatedAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() }, scope), true, "valid authenticated scope can write");
assert.equal(sessionCanWrite({ ...scope, authenticatedAt: now, expiresAt: new Date(Date.now() - 1).toISOString() }, scope), false, "expired offline session cannot write");
assert.equal(sessionCanWrite({ ...scope, authenticatedAt: now, expiresAt: new Date(Date.now() + 60_000).toISOString() }, { ...scope, locationId: "site-b" }), false, "offline scope cannot cross stores");

const storage = new Map();
globalThis.window = {
  localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  dispatchEvent: () => true,
};
const authUser = { id: "user-a", organisationId: "org-a", email: "staff@example.test", name: "Test Staff", role: "user", hasPassword: true };
const memberships = [{ userId: "user-a", locationId: "site-a", role: "staff" }];
establishOfflineSession(authUser, "site-a", memberships);
assert.equal(readOfflineAuthSession().user.id, "user-a", "offline lease restores the authenticated identity");
assert.equal(readOfflineAuthSession().memberships[0].locationId, "site-a", "offline lease restores only authorised store memberships");
const lease = JSON.parse(storage.get("le-feast-offline-lease"));
storage.set("le-feast-offline-lease", JSON.stringify({ ...lease, expiresAt: new Date(Date.now() - 1).toISOString() }));
assert.equal(readOfflineAuthSession(), null, "expired offline lease requires online reauthentication");
establishOfflineSession(authUser, "site-a", memberships);
clearOfflineSession();
assert.equal(readOfflineAuthSession(), null, "logout invalidates the offline lease");

const store = createMemoryOfflineStore();
await store.put(submission);
let requestCount = 0;
const transport = async (_url, init) => { requestCount++; assert.equal(init.headers["Idempotency-Key"], submission.submissionId); return new Response(JSON.stringify({ ok: true, data: { responseId: "server-response" } }), { status: 200 }); };
assert.equal(await syncSubmission(submission, store, transport), "synced");
assert.equal((await store.get(submission.submissionId)).state, "synced", "server confirmation is distinct from local pending state");
assert.equal(requestCount, 1);

const conflict = { ...submission, submissionId: "submission-00000002", state: "pending" };
await store.put(conflict);
const conflictResult = await syncSubmission(conflict, store, async () => new Response(JSON.stringify({ error: "duplicate" }), { status: 409 }));
assert.equal(conflictResult, "conflict");
assert.equal((await store.get(conflict.submissionId)).state, "conflict", "duplicate/conflict is retained for review");

let failures = 0;
const retry = { ...submission, submissionId: "submission-00000003", state: "pending", attempts: OFFLINE_MAX_ATTEMPTS - 1 };
await store.put(retry);
await syncSubmission(retry, store, async () => { failures++; throw new Error("network unavailable"); });
const failed = await store.get(retry.submissionId);
assert.equal(failures, 1);
assert.equal(failed.state, "failed");
assert.equal(failed.nextAttemptAt, null, "retry policy is bounded");
console.log("Offline foundation tests passed");
