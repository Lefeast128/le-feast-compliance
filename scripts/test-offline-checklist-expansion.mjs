import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createMemoryOfflineStore } from "../src/lib/offline/indexeddb.ts";
import { enqueueChecklistResponse, syncSubmission } from "../src/lib/offline/outbox.ts";

const scope = { organisationId: "org-offline", locationId: "store-offline", userId: "user-offline", deviceSessionId: "device-offline" };
const storage = new Map();
globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key), }, dispatchEvent() {}, addEventListener() {}, removeEventListener() {} };
const lease = { ...scope, authenticatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(), user: { id: scope.userId, organisationId: scope.organisationId, email: "staff@example.test", name: "Test Staff", role: "user", hasPassword: true }, memberships: [{ userId: scope.userId, locationId: scope.locationId, role: "staff" }] };
storage.set("le-feast-offline-lease", JSON.stringify(lease));

const store = createMemoryOfflineStore();
const queued = await enqueueChecklistResponse(scope, "closing", { locationId: scope.locationId, checklist: "closing", questionId: "00000000-0000-0000-0000-000000000001", answer: "no", problem: "Door was unsecured", action: "Door secured and manager informed", teamMemberId: "00000000-0000-0000-0000-000000000002" }, store);
assert.equal(queued.operation, "closing-checklist-response");
assert.equal((await store.list(scope, ["pending"])).length, 1);

let calls = 0;
const transport = async (_url, init) => {
  calls += 1;
  assert.equal(init.headers["Idempotency-Key"], queued.submissionId);
  return new Response(JSON.stringify({ responseId: "response-1" }), { status: 200, headers: { "content-type": "application/json" } });
};
assert.equal(await syncSubmission(queued, store, transport), "synced");
assert.equal((await store.get(queued.submissionId)).state, "synced");
assert.equal(calls, 1);

const checklist = await readFile(new URL("../src/components/InlineChecklist.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../src/server/compliance/checklist-service.ts", import.meta.url), "utf8");
assert.match(checklist, /offlineChecklistEnabled\(checklist\)/, "opening and closing checklists use the scoped feature flag");
assert.match(checklist, /enqueueChecklistResponse/, "checklist responses use the shared outbox");
assert.match(service, /operation: `\$\{input\.checklist\}-checklist-response`/, "server idempotency is scoped to the checklist kind");
assert.doesNotMatch(checklist, /answer !== "no"/, "failed checklist responses are not silently excluded from the pilot path");
console.log("Offline checklist expansion tests passed");
