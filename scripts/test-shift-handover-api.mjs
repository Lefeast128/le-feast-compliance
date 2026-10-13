/* Real API/PostgreSQL acceptance test for store-scoped Shift Handover. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const apiOrigin = "http://127.0.0.1:4174";
const origin = "http://127.0.0.1:5173";
const ids = {
  location: "00000000-0000-4000-8000-000000001002",
  location2: "00000000-0000-4000-8000-000000001011",
  location3: "00000000-0000-4000-8000-000000001015",
  staff: "offline.staff@example.test",
  manager: "offline.manager@example.test",
  admin: "offline.admin@example.test",
  other: "other.staff@example.test",
};
const server = spawn(process.execPath, ["--import=tsx/esm", "scripts/offline-browser-server.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out starting harness: ${output}`)), 90_000);
  const check = () => { if (output.includes('"ready":true')) { clearTimeout(timer); resolve(); } };
  server.stdout.on("data", check); server.stderr.on("data", check);
  server.on("exit", code => reject(new Error(`Harness exited (${code}): ${output}`)));
});
const close = () => new Promise(resolve => { server.once("exit", resolve); server.kill("SIGTERM"); });
const request = async (method, path, body, cookie, key) => {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  const response = await fetch(`${apiOrigin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let value; try { value = await response.json(); } catch { value = await response.text(); }
  if (value && typeof value === "object" && "data" in value) value = value.data;
  return { response, value };
};
const login = async email => {
  const result = await request("POST", "/api/auth/login", { email, password: "offline-test-password" });
  assert.equal(result.response.status, 200, JSON.stringify(result.value));
  return result.response.headers.get("set-cookie")?.split(";", 1)[0];
};
const expectStatus = (result, status, label) => assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.value)}\nHarness: ${output}`);
const create = (cookie, locationId, key, overrides = {}) => request("POST", "/api/handover", { locationId, title: "Closing note", message: "Please check the chilled display.", shift: "Closing", category: "action_required", ...overrides }, cookie, key);

try {
  await ready;
  const staff = await login(ids.staff);
  const manager = await login(ids.manager);
  const admin = await login(ids.admin);
  const other = await login(ids.other);

  const first = await create(staff, ids.location, "handover-note-0001");
  expectStatus(first, 200, "create handover note");
  const replay = await create(staff, ids.location, "handover-note-0001");
  expectStatus(replay, 200, "idempotent replay");
  assert.deepEqual(replay.value, first.value, "retry returns the original note result");
  expectStatus(await create(staff, ids.location, "handover-note-0001", { message: "different payload" }), 409, "idempotency payload mismatch");
  const firstId = first.value.noteId;

  const unread = await request("GET", `/api/handover?locationId=${ids.location}`, undefined, staff);
  expectStatus(unread, 200, "list handover notes");
  assert.equal(unread.value.unreadCount, 1, "new note is unread");
  assert.equal(unread.value.notes[0].author.email, ids.staff, "author is retained");
  expectStatus(await request("POST", `/api/handover/${firstId}/acknowledge`, {}, staff), 200, "acknowledge note");
  const read = await request("GET", `/api/handover?locationId=${ids.location}`, undefined, staff);
  assert.equal(read.value.unreadCount, 0, "acknowledgement clears only this user's unread count");
  assert.equal(read.value.notes[0].acknowledgedByMe, true);
  expectStatus(await request("POST", `/api/handover/${firstId}/acknowledge`, {}, staff), 200, "acknowledgement replay");

  const second = await create(staff, ids.location, "handover-note-0002", { title: "Urgent note", message: "Escalate through Issues & Corrective Actions.", category: "urgent" });
  expectStatus(second, 200, "create urgent note");
  expectStatus(await request("GET", `/api/handover?locationId=${ids.location2}`, undefined, staff), 403, "same organisation unauthorised store");
  expectStatus(await request("GET", `/api/handover?locationId=${ids.location}`, undefined, other), 403, "other organisation access");
  expectStatus(await create(other, ids.location, "handover-cross-org-0001"), 403, "cross organisation create");

  const actionForSecondStore = await create(manager, ids.location2, "handover-note-0003", { title: "Second store action" });
  expectStatus(actionForSecondStore, 200, "manager creates assigned-store note");
  expectStatus(await request("POST", `/api/handover/${actionForSecondStore.value.noteId}/resolve`, { resolutionNote: "Checked and handed to the next shift." }, manager), 200, "manager resolves action");
  expectStatus(await request("POST", `/api/handover/${second.value.noteId}/resolve`, { resolutionNote: "Should be forbidden for staff." }, staff), 403, "staff cannot resolve action");

  const adminResolution = await request("POST", `/api/handover/${firstId}/resolve`, { resolutionNote: "Reviewed by organisation admin." }, admin);
  expectStatus(adminResolution, 200, "organisation admin resolves note");
  const history = await request("GET", `/api/handover?locationId=${ids.location}`, undefined, staff);
  expectStatus(history, 200, "resolved note remains in history");
  assert.equal(history.value.notes.find(note => note.id === firstId).resolved, true, "resolved action remains auditable");
  const state = (await request("GET", "/__test__/state")).value;
  assert.equal(state.handover_notes, 2, "location-scoped notes persist exactly once");
  assert.equal(state.handover_acknowledgements, 1, "acknowledgements are immutable and idempotent");
  assert.equal(state.handover_resolutions, 1, "location-scoped resolutions are recorded once per note");
  assert.ok(state.submissions >= 2, "note publication idempotency claims persist");
  console.log(JSON.stringify({ ok: true, apiHandlers: true, postgres: true, storeIsolation: true, organisationIsolation: true, acknowledgements: true, resolutionHistory: true, state }));
} finally {
  await close();
}
