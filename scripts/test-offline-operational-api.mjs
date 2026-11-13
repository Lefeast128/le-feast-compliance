/* Real API/database acceptance test for the three offline operational workflows. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const apiOrigin = "http://127.0.0.1:4174";
const origin = "http://127.0.0.1:5173";
const ids = {
  location: "00000000-0000-4000-8000-000000001002", location2: "00000000-0000-4000-8000-000000001011",
  location3: "00000000-0000-4000-8000-000000001015", user: "offline.staff@example.test", user2: "offline.manager@example.test",
  otherUser: "other.staff@example.test", member: "00000000-0000-4000-8000-000000001005", memberAlt: "00000000-0000-4000-8000-000000001020", member2: "00000000-0000-4000-8000-000000001014",
  member3: "00000000-0000-4000-8000-000000001018", cleaning: "00000000-0000-4000-8000-000000001007", cleaningQuestion: "00000000-0000-4000-8000-000000001019",
  security: "00000000-0000-4000-8000-000000001008", cleaningConcurrent: "00000000-0000-4000-8000-000000001021", additional: "00000000-0000-4000-8000-000000001009",
};

const server = spawn(process.execPath, ["--import=tsx/esm", "scripts/offline-browser-server.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", chunk => { output += chunk.toString(); });
server.stderr.on("data", chunk => { output += chunk.toString(); });
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Timed out starting harness: ${output}`)), 90_000);
  const check = () => { const line = output.split("\n").find(value => value.includes('"ready":true')); if (line) { clearTimeout(timer); resolve(); } };
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
  let value = null; try { value = await response.json(); } catch { value = await response.text(); }
  return { response, value };
};
const post = (path, body, cookie, key) => request("POST", path, body, cookie, key);
const login = async email => {
  const result = await post("/api/auth/login", { email, password: "offline-test-password" });
  assert.equal(result.response.status, 200, JSON.stringify(result.value));
  const setCookie = result.response.headers.get("set-cookie");
  assert.ok(setCookie, "login must issue a session cookie");
  return setCookie.split(";", 1)[0];
};
const state = async () => (await request("GET", "/__test__/state")).value;
const expectStatus = (result, status, label) => assert.equal(result.response.status, status, `${label}: ${JSON.stringify(result.value)}`);

try {
  await ready;
  const cookie = await login(ids.user);
  const dashboard = await request("GET", `/api/dashboard?locationId=${ids.location}`, undefined, cookie);
  expectStatus(dashboard, 200, "dashboard loads");
  assert.ok(dashboard.value.cleaningTasks && dashboard.value.security && dashboard.value.additionalRequirements, "all workflow data is exposed by the real dashboard API");

  const cleaningKey = "offline-cleaning-00000001";
  const cleaningPayload = { locationId: ids.location, taskId: ids.cleaning, teamMemberId: ids.member };
  const cleaning = await post("/api/compliance/cleaning/completions", cleaningPayload, cookie, cleaningKey);
  expectStatus(cleaning, 200, "cleaning completion");
  const cleaningReplay = await post("/api/compliance/cleaning/completions", cleaningPayload, cookie, cleaningKey);
  expectStatus(cleaningReplay, 200, "cleaning replay");
  assert.deepEqual(cleaningReplay.value, cleaning.value, "cleaning replay returns the original result");
  const cleaningMismatch = await post("/api/compliance/cleaning/completions", { ...cleaningPayload, teamMemberId: ids.memberAlt }, cookie, cleaningKey);
  expectStatus(cleaningMismatch, 409, "cleaning payload mismatch");

  const securityKey = "offline-security-00000001";
  const securityPayload = { locationId: ids.location, session: "AM", questionId: ids.security, teamMemberId: ids.member };
  const security = await post("/api/compliance/security/responses", securityPayload, cookie, securityKey);
  expectStatus(security, 200, "security response");
  expectStatus(await post("/api/compliance/security/responses", securityPayload, cookie, securityKey), 200, "security replay");
  expectStatus(await post("/api/compliance/security/responses", { ...securityPayload, issue: "changed" }, cookie, securityKey), 409, "security payload mismatch");

  const additionalKey = "offline-additional-0001";
  const additionalPayload = { locationId: ids.location, requirementId: ids.additional, teamMemberId: ids.member, answers: [{ key: "done", value: "completed" }] };
  const failedAdditional = await post("/api/additional/complete", { ...additionalPayload, answers: [] }, cookie, additionalKey);
  expectStatus(failedAdditional, 422, "additional validation");
  const additional = await post("/api/additional/complete", additionalPayload, cookie, additionalKey);
  expectStatus(additional, 200, "additional completion after failed transaction");
  expectStatus(await post("/api/additional/complete", additionalPayload, cookie, additionalKey), 200, "additional replay");

  const failedStep = await post("/api/compliance/structured-tasks/responses", { locationId: ids.location, area: "cleaning", taskId: ids.cleaningQuestion, stepId: "answer", teamMemberId: ids.member, value: "no" }, cookie, "offline-step-fail-0001");
  expectStatus(failedStep, 422, "failed cleaning response requires evidence");
  const validStep = await post("/api/compliance/structured-tasks/responses", { locationId: ids.location, area: "cleaning", taskId: ids.cleaningQuestion, stepId: "answer", teamMemberId: ids.member, value: "no", problem: "Surface still dirty", action: "Cleaned again" }, cookie, "offline-step-valid-0001");
  expectStatus(validStep, 200, "failed cleaning response with corrective action");

  const concurrentKey = "offline-concurrent-0001";
  const concurrentPayload = { locationId: ids.location, area: "cleaning", taskId: ids.cleaningConcurrent, stepId: "answer", teamMemberId: ids.member, value: "yes" };
  const concurrent = await Promise.all([
    post("/api/compliance/structured-tasks/responses", concurrentPayload, cookie, concurrentKey),
    post("/api/compliance/structured-tasks/responses", concurrentPayload, cookie, concurrentKey),
  ]);
  assert.ok(concurrent.some(result => result.response.status === 200), `one concurrent submission succeeds: ${JSON.stringify(concurrent.map(result => result.value))}`);
  assert.ok(concurrent.every(result => [200, 409].includes(result.response.status)), `concurrent duplicate was unsafe: ${JSON.stringify(concurrent.map(result => result.value))}`);

  expectStatus(await post("/api/compliance/cleaning/completions", { ...cleaningPayload, locationId: ids.location2 }, cookie, "offline-cross-store-0001"), 403, "cross-store access");
  const otherCookie = await login(ids.otherUser);
  expectStatus(await post("/api/compliance/cleaning/completions", { ...cleaningPayload, locationId: ids.location }, otherCookie, "offline-cross-org-0001"), 403, "cross-organisation access");
  expectStatus(await request("GET", `/api/dashboard?locationId=${ids.location}`, undefined, otherCookie), 403, "cross-organisation dashboard access");

  const finalState = await state();
  assert.equal(finalState.cleaning, 1, "exactly one simple cleaning completion persisted");
  assert.equal(finalState.security, 1, "exactly one security response persisted");
  assert.equal(finalState.additional, 1, "exactly one additional completion persisted");
  assert.equal(finalState.structured, 2, "one failed-with-evidence and one concurrent structured response persisted");
  assert.equal(finalState.submissions, 5, "failed transactions do not leave claims and successful operations are idempotently claimed");
  console.log(JSON.stringify({ ok: true, workflows: ["cleaning", "security", "additional"], state: finalState, crossTenantIsolation: true, concurrentDuplicate: true }));
} finally {
  await close();
}
