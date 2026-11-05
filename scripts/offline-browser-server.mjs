/* Disposable local API server for real browser acceptance tests.
 * It owns a temporary PostgreSQL cluster and never accepts a non-loopback DB URL. */
import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { URL } from "node:url";
import { createPasswordCredential } from "../src/server/auth/core.ts";

const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "pipe", ...options });
const bin = (name) => {
  try { return execFileSync("which", [name], { encoding: "utf8" }).trim(); }
  catch {
    const directory = execFileSync("pg_config", ["--bindir"], { encoding: "utf8" }).trim();
    const candidate = join(directory, name);
    if (!existsSync(candidate)) throw new Error(`PostgreSQL executable not found: ${name}`);
    return candidate;
  }
};
const port = Number(process.env.EHO_OFFLINE_TEST_API_PORT ?? 4174);
const pgPort = port + 1;
const externalDbUrl = process.env.EHO_OFFLINE_TEST_DATABASE_URL?.trim() || undefined;
if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE === "1" && externalDbUrl) {
  throw new Error("Manager Overview integration fixtures require the harness-owned disposable PostgreSQL cluster");
}
if (externalDbUrl) {
  const hostname = new URL(externalDbUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) throw new Error("Offline browser harness accepts loopback PostgreSQL only");
}
const dataDir = externalDbUrl ? null : mkdtempSync(join(process.cwd(), ".eho-offline-browser-"));
const dbUrl = externalDbUrl ?? `postgresql://postgres@127.0.0.1:${pgPort}/postgres`;
let started = false;
let networkOffline = false;
let managerOverviewMode = "normal";
const testLog = (...parts) => { if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE === "1") console.log("[manager-overview-test]", ...parts); };
const ids = {
  org: "00000000-0000-4000-8000-000000001001", location: "00000000-0000-4000-8000-000000001002",
  user: "00000000-0000-4000-8000-000000001003", membership: "00000000-0000-4000-8000-000000001004",
  member: "00000000-0000-4000-8000-000000001005", question: "00000000-0000-4000-8000-000000001006", admin: "00000000-0000-4000-8000-000000001025",
  cleaning: "00000000-0000-4000-8000-000000001007", cleaningQuestion: "00000000-0000-4000-8000-000000001019", cleaningConcurrent: "00000000-0000-4000-8000-000000001021", memberAlt: "00000000-0000-4000-8000-000000001020", security: "00000000-0000-4000-8000-000000001008",
  additional: "00000000-0000-4000-8000-000000001009", org2: "00000000-0000-4000-8000-000000001010",
  location2: "00000000-0000-4000-8000-000000001011", user2: "00000000-0000-4000-8000-000000001012",
  membership2: "00000000-0000-4000-8000-000000001013", member2: "00000000-0000-4000-8000-000000001014",
  location3: "00000000-0000-4000-8000-000000001015", user3: "00000000-0000-4000-8000-000000001016",
  membership3: "00000000-0000-4000-8000-000000001017", member3: "00000000-0000-4000-8000-000000001018",
  location4: "00000000-0000-4000-8000-000000001026", membership4: "00000000-0000-4000-8000-000000001027",
  location5: "00000000-0000-4000-8000-000000001028",
  location6: "00000000-0000-4000-8000-000000001029",
  equipment: "00000000-0000-4000-8000-000000001022", probeProduct: "00000000-0000-4000-8000-000000001023", wastageItem: "00000000-0000-4000-8000-000000001024",
};
const credential = createPasswordCredential("offline-test-password");
const sql = (text) => run(bin("psql"), ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--dbname", dbUrl], { input: text, encoding: "utf8" });

function fixture() {
  const base = `
INSERT INTO organisations (id, name, timezone) VALUES ('${ids.org}', 'Offline Test Organisation', 'Europe/London');
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES ('${ids.location}', '${ids.org}', 'Offline Test Store', 'offline', 'Europe/London');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at, password_hash, password_salt) VALUES ('${ids.user}', '${ids.org}', 'offline.staff@example.test', 'offline.staff@example.test', 'Offline Test Staff', 'user', now(), '${credential.hash}', '${credential.salt}');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at, password_hash, password_salt) VALUES ('${ids.admin}', '${ids.org}', 'offline.admin@example.test', 'offline.admin@example.test', 'Offline Test Organisation Admin', 'admin', now(), '${credential.hash}', '${credential.salt}');
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
  if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE !== "1") return base;
  return `${base}
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES
  ('${ids.location4}', '${ids.org}', 'Task Four Manager Store', 'task4-manager', 'Europe/London'),
  ('${ids.location5}', '${ids.org}', 'Task Four Partial Failure Store', 'task4-error', 'Invalid/Test_Zone');
INSERT INTO locations (id, organisation_id, name, short_name, timezone, active) VALUES
  ('${ids.location6}', '${ids.org}', 'Task Four Inactive Store', 'task4-inactive', 'Europe/London', false);
INSERT INTO memberships (id, user_id, location_id, role) VALUES
  ('${ids.membership4}', '${ids.user2}', '${ids.location4}', 'manager');
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
  ["/api/manager-overview/stores", await load("api/manager-overview/stores.ts")],
  ["/api/manager-reviews", await load("api/manager-reviews.ts")],
  ["/api/controlled-documents", await load("api/controlled-documents.ts")],
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
  ["/api/catalogue/wastage", await load("api/catalogue/wastage.ts")],
  ["/api/reports/compliance", await load("api/reports/compliance.ts")],
  ["/api/admin/wastage", await load("api/admin/wastage.ts")],
  ["/api/admin/wastage-items", await load("api/admin/wastage-items.ts")],
  ["/api/markdown-sheet", await load("api/markdown-sheet.ts")],
  ["/api/admin/markdown-sheet", await load("api/admin/markdown-sheet.ts")],
  ["/api/handover", await load("api/handover.ts")],
]);

const dynamicHandlers = [
  [/^\/api\/admin\/wastage\/([^/]+)$/, "api/admin/wastage/[id].ts"],
  [/^\/api\/admin\/wastage-items\/([^/]+)$/, "api/admin/wastage-items/[id].ts"],
  [/^\/api\/compliance\/temperature-rounds\/([^/]+)\/complete$/, "api/compliance/temperature-rounds/[id]/complete.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/action$/, "api/compliance/issues/[id]/action.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/updates$/, "api/compliance/issues/[id]/updates.ts"],
  [/^\/api\/compliance\/issues\/([^/]+)\/recheck$/, "api/compliance/issues/[id]/recheck.ts"],
  [/^\/api\/compliance\/probe-issues\/([^/]+)\/recheck$/, "api/compliance/probe-issues/[id]/recheck.ts"],
  [/^\/api\/handover\/([^/]+)\/acknowledge$/, "api/handover/[id]/acknowledge.ts"],
  [/^\/api\/handover\/([^/]+)\/resolve$/, "api/handover/[id]/resolve.ts"],
  [/^\/api\/handover\/([^/]+)\/delete$/, "api/handover/[id]/delete.ts"],
];
for (const [, path] of dynamicHandlers) dynamicHandlers[dynamicHandlers.findIndex(([, candidate]) => candidate === path)][2] = await load(path);

async function shutdown() {
  try { await (await import("../src/server/db/client.ts")).getPool().end(); } catch {}
  if (started && dataDir) { try { run(bin("pg_ctl"), ["--pgdata", dataDir, "--mode", "immediate", "--wait", "stop"], { stdio: "ignore" }); } catch {} }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
}

let stopping = false;
async function stopServer() {
  if (stopping) return;
  stopping = true;
  server.closeAllConnections?.();
  await new Promise(resolve => server.close(() => resolve()));
  await shutdown();
}

if (dataDir) {
  testLog("initializing isolated PostgreSQL cluster");
  try {
    run(bin("initdb"), ["--no-locale", "--auth=trust", "--username=postgres", "--set", "shared_memory_type=mmap", "--set", "dynamic_shared_memory_type=mmap", "--pgdata", dataDir]);
  } catch (error) {
    rmSync(dataDir, { recursive: true, force: true });
    throw new Error(`Local PostgreSQL initdb failed: ${error.stderr?.toString() ?? error.message}`);
  }
  try {
    const postgresLog = join(dataDir, "postgres-startup.log");
    run(bin("pg_ctl"), ["--pgdata", dataDir, "--log", postgresLog, "--options", `-p ${pgPort} -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap -c shared_buffers=12MB`, "--wait", "start"]);
  } catch (error) {
    const postgresLog = join(dataDir, "postgres-startup.log");
    const detail = existsSync(postgresLog) ? readFileSync(postgresLog, "utf8") : error.stderr?.toString() ?? error.message;
    rmSync(dataDir, { recursive: true, force: true });
    throw new Error(`Local PostgreSQL startup failed: ${detail}`);
  }
  started = true;
  testLog("isolated PostgreSQL is ready");
}
const migrations = (await (await import("node:fs/promises")).readdir(new URL("../drizzle/", import.meta.url))).filter(value => value.endsWith(".sql")).sort();
testLog("applying", migrations.length, "schema migrations");
for (const name of migrations) {
  testLog("migration", name);
  sql(readFileSync(new URL(`../drizzle/${name}`, import.meta.url), "utf8").replaceAll("--> statement-breakpoint", ""));
}
testLog("applying fictional fixtures");
sql(fixture());
process.env.NODE_ENV = "test";
process.env.EHO_TEST_DATABASE_DRIVER = "pg";
process.env.DATABASE_URL = dbUrl;
process.env.AUTH_SESSION_SECRET = "offline-browser-test-session-secret";
process.env.AUTH_ALLOWED_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173";

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE === "1" && url.pathname === "/__test__/manager-overview-mode") {
    const requested = url.searchParams.get("mode");
    managerOverviewMode = ["normal", "slow", "error"].includes(requested ?? "") ? requested : "normal";
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ mode: managerOverviewMode }));
    return;
  }
  if (url.pathname === "/__test__/network") { networkOffline = url.searchParams.get("state") === "offline"; response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify({ networkOffline })); return; }
  if (url.pathname === "/__test__/state") {
    const client = await (await import("../src/server/db/client.ts")).getPool().connect();
    try {
      const result = await client.query("SELECT (SELECT count(*)::int FROM checklist_responses WHERE location_id = $1) AS responses, (SELECT count(*)::int FROM checklist_sign_offs WHERE location_id = $1) AS signoffs, (SELECT count(*)::int FROM cleaning_completions WHERE location_id = $1) AS cleaning, (SELECT count(*)::int FROM security_responses WHERE location_id = $1) AS security, (SELECT count(*)::int FROM structured_task_responses WHERE location_id = $1) AS structured, (SELECT count(*)::int FROM additional_completions WHERE location_id = $1) AS additional, (SELECT count(*)::int FROM temperature_readings WHERE location_id = $1) AS temperature, (SELECT min(captured_at) FROM temperature_readings WHERE location_id = $1) AS temperature_capture, (SELECT count(*)::int FROM food_checks WHERE location_id = $1) AS probes, (SELECT count(*)::int FROM issues WHERE location_id = $1) AS issues, (SELECT count(*)::int FROM issue_updates WHERE location_id = $1) AS issue_updates, (SELECT count(*)::int FROM rechecks WHERE location_id = $1) AS rechecks, (SELECT count(*)::int FROM wastage_records WHERE location_id = $1) AS wastage, (SELECT count(*)::int FROM offline_submissions WHERE location_id = $1) AS submissions, (SELECT count(*)::int FROM shift_handover_notes WHERE location_id = $1) AS handover_notes, (SELECT count(*)::int FROM shift_handover_acknowledgements a JOIN shift_handover_notes n ON n.id = a.note_id WHERE n.location_id = $1) AS handover_acknowledgements, (SELECT count(*)::int FROM shift_handover_resolutions r JOIN shift_handover_notes n ON n.id = r.note_id WHERE n.location_id = $1) AS handover_resolutions", [ids.location]);
      response.writeHead(200, { "Content-Type": "application/json" }); response.end(JSON.stringify(result.rows[0]));
    } finally { client.release(); }
    return;
  }
  if (networkOffline) { response.writeHead(503, { "Content-Type": "application/json" }); response.end(JSON.stringify({ ok: false, error: "Simulated temporary network failure" })); return; }
  if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE === "1" && url.pathname === "/api/manager-overview/stores") {
    if (managerOverviewMode === "slow") await new Promise(resolve => setTimeout(resolve, 1800));
    if (managerOverviewMode === "error") {
      response.writeHead(503, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: "Fictional test failure" }));
      return;
    }
  }
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
  try {
    await handler({ method: request.method, body, query, headers }, apiResponse);
    if (process.env.EHO_MANAGER_OVERVIEW_FIXTURE === "1" && ["/api/auth/session", "/api/locations", "/api/dashboard", "/api/manager-reviews", "/api/controlled-documents", "/api/additional"].includes(url.pathname)) {
      console.log(`[browser-test] ${request.method} ${url.pathname} ${response.statusCode ?? status}${url.pathname === "/api/dashboard" ? ` query=${url.search || "<empty>"}` : ""}`);
    }
  }
  catch (error) { console.error("offline harness handler error", error); response.statusCode = 500; response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Test server error" })); }
});

server.listen(port, "127.0.0.1", () => {
  console.log(JSON.stringify({ ready: true, api: `http://127.0.0.1:${port}`, testUser: "offline.staff@example.test", testLocationId: ids.location }));
});
process.on("SIGINT", () => { void stopServer(); });
process.on("SIGTERM", () => { void stopServer(); });
