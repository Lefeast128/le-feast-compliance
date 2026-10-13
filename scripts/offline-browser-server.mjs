/* Disposable local API server for real browser acceptance tests.
 * It owns a temporary PostgreSQL cluster and never accepts a non-loopback DB URL. */
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { URL } from "node:url";
import { createPasswordCredential } from "../src/server/auth/core.ts";

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "pipe", ...options });
const bin = (name) => execFileSync("which", [name], { encoding: "utf8" }).trim();
const port = Number(process.env.EHO_OFFLINE_TEST_API_PORT ?? 4174);
const pgPort = port + 1;
const externalDbUrl = process.env.EHO_OFFLINE_TEST_DATABASE_URL;
const dataDir = externalDbUrl ? null : mkdtempSync(join(tmpdir(), "eho-offline-browser-"));
const dbUrl = externalDbUrl ?? `postgresql://postgres@127.0.0.1:${pgPort}/postgres`;
let started = false;
let networkOffline = false;
const ids = {
  org: "00000000-0000-4000-8000-000000001001", location: "00000000-0000-4000-8000-000000001002",
  user: "00000000-0000-4000-8000-000000001003", membership: "00000000-0000-4000-8000-000000001004",
  member: "00000000-0000-4000-8000-000000001005", question: "00000000-0000-4000-8000-000000001006",
  cleaning: "00000000-0000-4000-8000-000000001007", cleaningQuestion: "00000000-0000-4000-8000-000000001019", cleaningConcurrent: "00000000-0000-4000-8000-000000001021", memberAlt: "00000000-0000-4000-8000-000000001020", security: "00000000-0000-4000-8000-000000001008",
  additional: "00000000-0000-4000-8000-000000001009", org2: "00000000-0000-4000-8000-000000001010",
  location2: "00000000-0000-4000-8000-000000001011", user2: "00000000-0000-4000-8000-000000001012",
  membership2: "00000000-0000-4000-8000-000000001013", member2: "00000000-0000-4000-8000-000000001014",
  location3: "00000000-0000-4000-8000-000000001015", user3: "00000000-0000-4000-8000-000000001016",
  membership3: "00000000-0000-4000-8000-000000001017", member3: "00000000-0000-4000-8000-000000001018",
  equipment: "00000000-0000-4000-8000-000000001022", probeProduct: "00000000-0000-4000-8000-000000001023", wastageItem: "00000000-0000-4000-8000-000000001024",
};
const credential = createPasswordCredential("offline-test-password");
const sql = (text) => run(bin("psql"), ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--dbname", dbUrl], { input: text, encoding: "utf8" });

function fixture() {
  return `
INSERT INTO organisations (id, name, timezone) VALUES ('${ids.org}', 'Offline Test Organisation', 'Europe/London');
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES ('${ids.location}', '${ids.org}', 'Offline Test Store', 'offline', 'Europe/London');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at, password_hash, password_salt) VALUES ('${ids.user}', '${ids.org}', 'offline.staff@example.test', 'offline.staff@example.test', 'Offline Test Staff', 'user', now(), '${credential.hash}', '${credential.salt}');
INSERT INTO memberships (id, user_id, location_id, role) VALUES ('${ids.membership}', '${ids.user}', '${ids.location}', 'staff');
INSERT INTO team_members (id, location_id, name, role) VALUES ('${ids.member}', '${ids.location}', 'Offline Test Team Member', 'team');
INSERT INTO team_members (id, location_id, name, role) VALUES ('${ids.memberAlt}', '${ids.location}', 'Offline Test Second Team Member', 'team');
INSERT INTO checklist_questions (id, location_id, checklist, question, task_type, completion_mode, steps, sort_order) VALUES ('${ids.question}', '${ids.location}', 'opening', 'Offline test: handwash station ready?', 'simple', 'question', '[]'::jsonb, 0);
INSERT INTO cleaning_tasks (id, location_id, name, task_type, completion_mode, steps, frequency, weekdays, sort_order) VALUES ('${ids.cleaning}', '${ids.location}', 'Offline test: clean surfaces', 'simple', 'task', '[]'::jsonb, 'daily', '[]'::jsonb, 0);
INSERT INTO cleaning_tasks (id, location_id, name, task_type, completion_mode, steps, frequency, weekdays, sort_order) VALUES ('${ids.cleaningQuestion}', '${ids.location}', 'Offline test: check cleaning result', 'with_steps', 'question', '[{"id":"answer","label":"Cleaning is satisfactory?","responseType":"yes_no","required":true}]'::jsonb, 'daily', '[]'::jsonb, 1);
INSERT INTO cleaning_tasks (id, location_id, name, task_type, completion_mode, steps, frequency, weekdays, sort_order) VALUES ('${ids.cleaningConcurrent}', '${ids.location}', 'Offline test: concurrent cleaning result', 'with_steps', 'question', '[{"id":"answer","label":"Concurrent cleaning check?","responseType":"yes_no","required":true}]'::jsonb, 'daily', '[]'::jsonb, 2);
INSERT INTO security_questions (id, location_id, session, question, task_type, completion_mode, steps, sort_order) VALUES ('${ids.security}', '${ids.location}', 'AM', 'Offline test: doors secure?', 'simple', 'question', '[]'::jsonb, 0);
INSERT INTO additional_requirements (id, location_id, title, frequency, next_due_at, fields, sort_order) VALUES ('${ids.additional}', '${ids.location}', 'Offline test: probe calibration', 'daily', now() - interval '1 hour', '[{"key":"done","label":"Completed","type":"completed"}]'::jsonb, 0);
INSERT INTO equipment (id, location_id, name, type, minimum_temperature, preferred_temperature, maximum_temperature, sort_order) VALUES ('${ids.equipment}', '${ids.location}', 'Offline test fridge', 'fridge', 0, 5, 8, 0);
INSERT INTO probe_products (id, organisation_id, name, minimum_temperature, hold_minutes, location_ids, sort_order) VALUES ('${ids.probeProduct}', '${ids.org}', 'Offline test chicken', 75, 30, '["${ids.location}"]'::jsonb, 0);
INSERT INTO wastage_items (id, location_id, name, sort_order) VALUES ('${ids.wastageItem}', '${ids.location}', 'Offline test item', 0);
INSERT INTO organisations (id, name, timezone) VALUES ('${ids.org2}', 'Second Offline Organisation', 'Europe/London');
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES ('${ids.location2}', '${ids.org}', 'Second Offline Store', 'offline-2', 'Europe/London');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at, password_hash, password_salt) VALUES ('${ids.user2}', '${ids.org}', 'offline.manager@example.test', 'offline.manager@example.test', 'Offline Test Manager', 'user', now(), '${credential.hash}', '${credential.salt}');
INSERT INTO memberships (id, user_id, location_id, role) VALUES ('${ids.membership2}', '${ids.user2}', '${ids.location2}', 'manager');
INSERT INTO team_members (id, location_id, name, role) VALUES ('${ids.member2}', '${ids.location2}', 'Second Store Team Member', 'team');
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES ('${ids.location3}', '${ids.org2}', 'Other Organisation Store', 'other', 'Europe/London');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at, password_hash, password_salt) VALUES ('${ids.user3}', '${ids.org2}', 'other.staff@example.test', 'other.staff@example.test', 'Other Organisation Staff', 'user', now(), '${credential.hash}', '${credential.salt}');
INSERT INTO memberships (id, user_id, location_id, role) VALUES ('${ids.membership3}', '${ids.user3}', '${ids.location3}', 'staff');
INSERT INTO team_members (id, location_id, name, role) VALUES ('${ids.member3}', '${ids.location3}', 'Other Organisation Team Member', 'team');
`;
}

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return undefined;
  try { return JSON.parse(text); } catch { return text; }
}

const load = async (path) => (await import(`../${path}`)).default;
const handlers = new Map([
  ["/api/auth/session", await load("api/auth/session.ts")],
  ["/api/auth/login", await load("api/auth/login.ts")],
  ["/api/auth/logout", await load("api/auth/logout.ts")],
  ["/api/locations", await load("api/locations.ts")],
  ["/api/dashboard", await load("api/dashboard.ts")],
  ["/api/structured-tasks", await load("api/structured-tasks.ts")],
  ["/api/team-members", await load("api/team-members.ts")],
  ["/api/compliance/checklists/responses", await load("api/compliance/checklists/responses.ts")],
  ["/api/compliance/cleaning/completions", await load("api/compliance/cleaning/completions.ts")],
  ["/api/compliance/security/responses", await load("api/compliance/security/responses.ts")],
  ["/api/compliance/security/signoff", await load("api/compliance/security/signoff.ts")],
  ["/api/compliance/structured-tasks/responses", await load("api/compliance/structured-tasks/responses.ts")],
  ["/api/additional/complete", await load("api/additional/complete.ts")],
  ["/api/additional", await load("api/additional.ts")],
  ["/api/compliance/temperature-rounds", await load("api/compliance/temperature-rounds.ts")],
  ["/api/compliance/temperature-readings", await load("api/compliance/temperature-readings.ts")],
  ["/api/compliance/food-checks", await load("api/compliance/food-checks.ts")],
  ["/api/compliance/issues", await load("api/compliance/issues.ts")],
  ["/api/compliance/wastage", await load("api/compliance/wastage.ts")],
]);

const dynamicHandlers = [
  [/^\/api\/compliance\/temperature-rounds\/([^/]+)\/complete$/, "api/compliance/temperature-rounds/[id]/complete.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/action$/, "api/compliance/issues/[id]/action.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/updates$/, "api/compliance/issues/[id]/updates.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/recheck$/, "api/compliance/issues/[id]/recheck.ts"],
  [/^\/api\/compliance\/probe-issues\/([^/]+)\/recheck$/, "api/compliance/probe-issues/[id]/recheck.ts"],
];
for (const [, path] of dynamicHandlers) dynamicHandlers[dynamicHandlers.findIndex(([, candidate]) => candidate === path)][2] = await load(path);

async function shutdown() {
  try { await (await import("../src/server/db/client.ts")).getPool().end(); } catch {}
  if (started && dataDir) { try { run(bin("pg_ctl"), ["--pgdata", dataDir, "--mode", "immediate", "--wait", "stop"], { stdio: "ignore" }); } catch {} }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
}

if (dataDir) {
  run(bin("initdb"), ["--no-locale", "--auth=trust", "--username=postgres", "--set", "shared_memory_type=mmap", "--set", "dynamic_shared_memory_type=mmap", "--pgdata", dataDir], { stdio: "ignore" });
  run(bin("pg_ctl"), ["--pgdata", dataDir, "--options", `-p ${pgPort} -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap -c shared_buffers=12MB`, "--wait", "start"], { stdio: "ignore" });
  started = true;
}
const migrations = await (await import("node:fs/promises")).readdir(new URL("../drizzle/", import.meta.url));
for (const name of migrations.filter((value) => value.endsWith(".sql")).sort()) sql(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
sql(fixture());
process.env.NODE_ENV = "test";
process.env.EHO_TEST_DATABASE_DRIVER = "pg";
process.env.DATABASE_URL = dbUrl;
process.env.AUTH_SESSION_SECRET = "offline-browser-test-session-secret";
process.env.AUTH_ALLOWED_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173";

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/__test__/network") { networkOffline = url.searchParams.get("state") === "offline"; response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ networkOffline })); return; }
  if (url.pathname === "/__test__/state") {
    const client = await (await import("../src/server/db/client.ts")).getPool().connect();
    try {
      const result = await client.query("SELECT (SELECT count(*)::int FROM checklist_responses WHERE location_id = $1) AS responses, (SELECT count(*)::int FROM checklist_sign_offs WHERE location_id = $1) AS signoffs, (SELECT count(*)::int FROM cleaning_completions WHERE location_id = $1) AS cleaning, (SELECT count(*)::int FROM security_responses WHERE location_id = $1) AS security, (SELECT count(*)::int FROM structured_task_responses WHERE location_id = $1) AS structured, (SELECT count(*)::int FROM additional_completions WHERE location_id = $1) AS additional, (SELECT count(*)::int FROM temperature_readings WHERE location_id = $1) AS temperature, (SELECT min(created_at) FROM temperature_readings WHERE location_id = $1) AS temperature_capture, (SELECT count(*)::int FROM food_checks WHERE location_id = $1) AS probes, (SELECT count(*)::int FROM issues WHERE location_id = $1) AS issues, (SELECT count(*)::int FROM issue_updates WHERE location_id = $1) AS issue_updates, (SELECT count(*)::int FROM rechecks WHERE location_id = $1) AS rechecks, (SELECT count(*)::int FROM wastage_records WHERE location_id = $1) AS wastage, (SELECT count(*)::int FROM offline_submissions WHERE location_id = $1) AS submissions", [ids.location]);
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(result.rows[0]));
    } finally { client.release(); }
    return;
  }
  if (networkOffline) { response.writeHead(503, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: false, error: "Simulated temporary network failure" })); return; }
  let handler = handlers.get(url.pathname);
  let routeParamId;
  if (!handler) {
    const match = dynamicHandlers.find(([pattern]) => pattern.test(url.pathname));
    if (match) { routeParamId = url.pathname.match(match[0])?.[1]; handler = match[2]; }
  }
  if (!handler) { response.writeHead(404); response.end("Not found"); return; }
  const body = await bodyOf(request);
  const query = Object.fromEntries(url.searchParams.entries());
  if (routeParamId) query.id = routeParamId;
  const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, value ?? undefined]));
  let status = 200;
  const apiResponse = {
    status(code) { status = code; return apiResponse; },
    setHeader(name, value) { response.setHeader(name, value); },
    json(value) { response.statusCode = status; response.setHeader("Content-Type", "application/json"); response.end(JSON.stringify(value)); },
    send(value) { response.statusCode = status; response.end(value); },
    end(value) { response.statusCode = status; response.end(value); },
  };
  try { await handler({ method: request.method, body, query, headers }, apiResponse); }
  catch (error) { console.error("offline harness handler error", error); response.statusCode = 500; response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Test server error" })); }
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ ready: true, api: `http://127.0.0.1:${port}`, browserPassword: "offline-test-password", testUser: "offline.staff@example.test", testLocationId: ids.location }));
});
process.on("SIGINT", () => { server.close(); void shutdown(); });
process.on("SIGTERM", () => { server.close(); void shutdown(); });
