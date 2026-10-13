/* Real API/PostgreSQL acceptance tests for offline temperature, probe, issue and wastage mutations. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const apiOrigin = "http://127.0.0.1:4174";
const origin = "http://127.0.0.1:5173";
const ids = {
  location: "00000000-0000-4000-8000-000000001002", location2: "00000000-0000-4000-8000-000000001011",
  location3: "00000000-0000-4000-8000-000000001015", user: "offline.staff@example.test", otherUser: "other.staff@example.test",
  member: "00000000-0000-4000-8000-000000001005", member2: "00000000-0000-4000-8000-000000001014",
  equipment: "00000000-0000-4000-8000-000000001022", probeProduct: "00000000-0000-4000-8000-000000001023", wastageItem: "00000000-0000-4000-8000-000000001024",
};
const server = spawn(process.execPath, ["--import=tsx/esm", "scripts/offline-browser-server.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out starting harness: ${output}`)), 90_000);
  const check = () => { if (output.split("\n").some(value => value.includes('"ready":true'))) { clearTimeout(timer); resolve(); } };
  server.stdout.on("data", check); server.stderr.on("data", check);
  server.on("exit", code => reject(new Error(`Harness exited (${code}): ${output}`)));
});
const close = () => new Promise(resolve => { server.once("exit", resolve); server.kill("SIGTERM"); });
const request = async (method, path, body, cookie, key, capturedAt) => {
  const headers = { Origin: origin };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  if (capturedAt) headers["X-Offline-Captured-At"] = capturedAt;
  const response = await fetch(`${apiOrigin}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let value; try { value = JSON.parse(raw); } catch { value = raw; }
  return { response, value };
};
const post = (path, body, cookie, key, capturedAt) => request("POST", path, body, cookie, key, capturedAt);
const login = async email => {
  const result = await post("/api/auth/login", { email, password: "offline-test-password" });
  assert.equal(result.response.status, 200, JSON.stringify(result.value));
  return result.response.headers.get("set-cookie").split(";", 1)[0];
};
const expectStatus = (result, status, label) => assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.value)}\n${output}`);
const data = result => result.value?.data;
const state = async () => (await request("GET", "/__test__/state")).value;

try {
  await ready;
  const cookie = await login(ids.user);
  const round = await post("/api/compliance/temperature-rounds", { locationId: ids.location, session: "AM", teamMemberId: ids.member }, cookie);
  expectStatus(round, 200, "temperature round starts");
  const roundId = data(round).roundId;
  const temperaturePayload = { roundId, locationId: ids.location, equipmentId: ids.equipment, temperature: 10, teamMemberId: ids.member };
  const temperatureKey = "offline-temperature-0001";
  const capturedAt = new Date(Date.now() - 60_000).toISOString();
  const temperature = await post("/api/compliance/temperature-readings", temperaturePayload, cookie, temperatureKey, capturedAt);
  expectStatus(temperature, 200, "failed temperature is recorded");
  expectStatus(await post("/api/compliance/temperature-readings", temperaturePayload, cookie, temperatureKey, capturedAt), 200, "temperature replay");
  expectStatus(await post("/api/compliance/temperature-readings", { ...temperaturePayload, temperature: 11 }, cookie, temperatureKey, capturedAt), 409, "temperature payload mismatch");
  const temperatureIssueId = data(temperature).issueId;
  const actionPayload = { action: "Moved food to a safe unit", teamMemberId: ids.member };
  const action = await post(`/api/compliance/issues/${temperatureIssueId}/action`, actionPayload, cookie, "offline-temperature-action-0001");
  expectStatus(action, 200, "temperature corrective action");
  expectStatus(await post(`/api/compliance/issues/${temperatureIssueId}/action`, actionPayload, cookie, "offline-temperature-action-0001"), 200, "temperature action replay");
  const recheckPayload = { temperature: 5, teamMemberId: ids.member };
  const recheck = await post(`/api/compliance/issues/${temperatureIssueId}/recheck`, recheckPayload, cookie, "offline-temperature-recheck-0001");
  expectStatus(recheck, 200, "temperature passing recheck");
  expectStatus(await post(`/api/compliance/issues/${temperatureIssueId}/recheck`, recheckPayload, cookie, "offline-temperature-recheck-0001"), 200, "temperature recheck replay");
  expectStatus(await post(`/api/compliance/temperature-rounds/${roundId}/complete`, { locationId: ids.location, session: "AM", teamMemberId: ids.member }, cookie), 200, "temperature round completion");

  const probePayload = { locationId: ids.location, product: "Offline test chicken", quantity: "1", temperature: 70, action: "Reheated thoroughly", teamMemberId: ids.member };
  const probe = await post("/api/compliance/food-checks", probePayload, cookie, "offline-probe-0001");
  expectStatus(probe, 200, "failed probe is recorded");
  expectStatus(await post("/api/compliance/food-checks", probePayload, cookie, "offline-probe-0001"), 200, "probe replay");
  const probeIssueId = data(probe).issueId;
  const probeRecheckPayload = { temperature: 80, teamMemberId: ids.member };
  expectStatus(await post(`/api/compliance/probe-issues/${probeIssueId}/recheck`, probeRecheckPayload, cookie, "offline-probe-recheck-0001"), 200, "probe passing recheck");
  expectStatus(await post(`/api/compliance/probe-issues/${probeIssueId}/recheck`, probeRecheckPayload, cookie, "offline-probe-recheck-0001"), 200, "probe recheck replay");

  const manual = await post("/api/compliance/issues", { locationId: ids.location, description: "Offline manual issue", teamMemberId: ids.member }, cookie, "offline-issue-0001");
  expectStatus(manual, 200, "manual issue");
  const manualIssueId = data(manual).issueId;
  const updatePayload = { note: "Follow-up completed", status: "resolved", updateType: "resolution", teamMemberId: ids.member };
  expectStatus(await post(`/api/compliance/issues/${manualIssueId}/updates`, updatePayload, cookie, "offline-issue-update-0001"), 200, "manual issue resolution");
  expectStatus(await post(`/api/compliance/issues/${manualIssueId}/updates`, updatePayload, cookie, "offline-issue-update-0001"), 200, "manual issue resolution replay");

  const noWaste = { locationId: ids.location, noWaste: true, teamMemberId: ids.member };
  expectStatus(await post("/api/compliance/wastage", noWaste, cookie, "offline-wastage-no-waste-0001"), 200, "no-waste record");
  expectStatus(await post("/api/compliance/wastage", noWaste, cookie, "offline-wastage-no-waste-0001"), 200, "no-waste replay");
  const wastage = { locationId: ids.location, itemId: ids.wastageItem, quantity: "2", noWaste: false, teamMemberId: ids.member };
  expectStatus(await post("/api/compliance/wastage", wastage, cookie, "offline-wastage-0001"), 200, "wastage record");
  expectStatus(await post("/api/compliance/wastage", { ...wastage, quantity: "3" }, cookie, "offline-wastage-0001"), 409, "wastage payload mismatch");

  expectStatus(await post("/api/compliance/food-checks", { ...probePayload, locationId: ids.location2 }, cookie, "offline-cross-store-probe-0001"), 403, "cross-store probe access");
  const otherCookie = await login(ids.otherUser);
  expectStatus(await post("/api/compliance/wastage", noWaste, otherCookie, "offline-cross-org-wastage-0001"), 403, "cross-organisation wastage access");
  const finalState = await state();
  assert.equal(finalState.temperature, 1, "one original temperature reading persisted");
  assert.ok(Date.parse(finalState.temperature_capture) <= Date.now(), "offline capture timestamp is accepted and persisted");
  assert.equal(finalState.probes, 1, "one original probe reading persisted");
  assert.equal(finalState.issues, 3, "temperature, probe and manual issues persisted");
  assert.equal(finalState.rechecks, 2, "temperature and probe rechecks persisted once");
  assert.equal(finalState.wastage, 2, "no-waste and item wastage persisted once");
  assert.equal(finalState.submissions, 9, "successful operations claimed exactly once");
  console.log(JSON.stringify({ ok: true, phases: ["temperature", "probe", "issues", "wastage"], state: finalState, duplicatePrevention: true, crossTenantIsolation: true }));
} finally {
  await close();
}
