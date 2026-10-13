import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHmac } from "node:crypto";

const postgresBin = name => execFileSync("which", [name], { encoding: "utf8" }).trim();
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "pipe", ...options });
const sql = (url, text) => run(postgresBin("psql"), ["--no-psqlrc", "--quiet", "--set", "ON_ERROR_STOP=1", "--dbname", url], { input: text, encoding: "utf8" });

const ids = {
  orgA: "00000000-0000-4000-8000-000000000001",
  orgB: "00000000-0000-4000-8000-000000000002",
  storeA1: "00000000-0000-4000-8000-000000000011",
  storeA2: "00000000-0000-4000-8000-000000000012",
  storeB1: "00000000-0000-4000-8000-000000000021",
  adminA: "00000000-0000-4000-8000-000000000101",
  managerA: "00000000-0000-4000-8000-000000000102",
  adminB: "00000000-0000-4000-8000-000000000201",
  memberA1: "00000000-0000-4000-8000-000000000301",
  memberA2: "00000000-0000-4000-8000-000000000302",
  memberB1: "00000000-0000-4000-8000-000000000303",
  docA: "00000000-0000-4000-8000-000000000401",
  docB: "00000000-0000-4000-8000-000000000402",
  controlledA: "00000000-0000-4000-8000-000000000501",
  controlledB: "00000000-0000-4000-8000-000000000502",
  controlledVersionA: "00000000-0000-4000-8000-000000000601",
  controlledVersionB: "00000000-0000-4000-8000-000000000602",
  libraryA: "00000000-0000-4000-8000-000000000701",
  libraryVersionA: "00000000-0000-4000-8000-000000000801",
};

const secret = "local-api-isolation-secret";
const token = name => `local-${name}-session-token`;
const tokenHash = value => createHmac("sha256", secret).update(value).digest("hex");
const cookie = value => `lf_session=${encodeURIComponent(value)}`;

const fixture = `
INSERT INTO organisations (id, name, timezone) VALUES
  ('${ids.orgA}', 'Fictional Cafe Group A', 'Europe/London'),
  ('${ids.orgB}', 'Fictional Cafe Group B', 'Europe/London');
INSERT INTO locations (id, organisation_id, name, short_name, timezone) VALUES
  ('${ids.storeA1}', '${ids.orgA}', 'A One', 'A1', 'Europe/London'),
  ('${ids.storeA2}', '${ids.orgA}', 'A Two', 'A2', 'Europe/London'),
  ('${ids.storeB1}', '${ids.orgB}', 'B One', 'B1', 'Europe/London');
INSERT INTO users (id, organisation_id, email, normalized_email, name, role, email_verified_at) VALUES
  ('${ids.adminA}', '${ids.orgA}', 'admin-a@example.test', 'admin-a@example.test', 'Admin A', 'admin', now()),
  ('${ids.managerA}', '${ids.orgA}', 'manager-a@example.test', 'manager-a@example.test', 'Manager A', 'user', now()),
  ('${ids.adminB}', '${ids.orgB}', 'admin-b@example.test', 'admin-b@example.test', 'Admin B', 'admin', now());
INSERT INTO memberships (user_id, location_id, role) VALUES
  ('${ids.managerA}', '${ids.storeA1}', 'manager');
INSERT INTO team_members (id, location_id, name, role) VALUES
  ('${ids.memberA1}', '${ids.storeA1}', 'Team A1', 'team'),
  ('${ids.memberA2}', '${ids.storeA2}', 'Team A2', 'team'),
  ('${ids.memberB1}', '${ids.storeB1}', 'Team B1', 'team');
INSERT INTO auth_sessions (id, user_id, token_hash, expires_at) VALUES
  ('00000000-0000-4000-8000-000000000901', '${ids.adminA}', '${tokenHash(token("admin-a"))}', now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000902', '${ids.managerA}', '${tokenHash(token("manager-a"))}', now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000903', '${ids.adminB}', '${tokenHash(token("admin-b"))}', now() + interval '1 hour');
INSERT INTO documents (id, organisation_id, location_id, pathname, original_filename, content_type, size, purpose, created_by)
VALUES
  ('${ids.docA}', '${ids.orgA}', '${ids.storeA1}', 'local/a.pdf', 'a.pdf', 'application/pdf', 10, 'controlled_document', '${ids.adminA}'),
  ('${ids.docB}', '${ids.orgB}', '${ids.storeB1}', 'local/b.pdf', 'b.pdf', 'application/pdf', 10, 'controlled_document', '${ids.adminB}');
INSERT INTO controlled_documents (id, organisation_id, title, category, location_ids, allocation_mode, require_training_acknowledgement, created_by)
VALUES
  ('${ids.controlledA}', '${ids.orgA}', 'Controlled A', 'food_safety', '["${ids.storeA1}"]'::jsonb, 'selected', true, '${ids.adminA}'),
  ('${ids.controlledB}', '${ids.orgB}', 'Controlled B', 'food_safety', '["${ids.storeB1}"]'::jsonb, 'selected', true, '${ids.adminB}');
INSERT INTO controlled_document_versions (id, controlled_document_id, document_id, version_number, published_at, created_by)
VALUES
  ('${ids.controlledVersionA}', '${ids.controlledA}', '${ids.docA}', 1, now(), '${ids.adminA}'),
  ('${ids.controlledVersionB}', '${ids.controlledB}', '${ids.docB}', 1, now(), '${ids.adminB}');
INSERT INTO library_documents (id, organisation_id, title, category, location_ids, allocation_mode, controlled_document_id, created_by)
VALUES ('${ids.libraryA}', '${ids.orgA}', 'Library A', 'food_safety', '["${ids.storeA1}"]'::jsonb, 'selected', '${ids.controlledA}', '${ids.adminA}');
INSERT INTO library_document_versions (id, library_document_id, document_id, controlled_document_version_id, version_number, created_by)
VALUES ('${ids.libraryVersionA}', '${ids.libraryA}', '${ids.docA}', '${ids.controlledVersionA}', 1, '${ids.adminA}');
`;

const invoke = async (handler, request) => {
  let statusCode = 200;
  let body;
  let sent;
  const response = {
    status(code) { statusCode = code; return response; },
    json(value) { body = value; },
    setHeader() {},
    send(value) { sent = value; },
  };
  await handler(request, response);
  return { status: statusCode, body, sent };
};

const test = async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "eho-api-tenant-isolation-"));
  const port = 55432 + Math.floor(Math.random() * 200);
  const dbUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  let started = false;
  try {
    run(postgresBin("initdb"), ["--no-locale", "--auth=trust", "--username=postgres", "--pgdata", dataDir], { stdio: "ignore" });
    run(postgresBin("pg_ctl"), ["--pgdata", dataDir, "--options", `-p ${port} -c shared_memory_type=mmap -c dynamic_shared_memory_type=mmap -c shared_buffers=12MB`, "--wait", "start"], { stdio: "ignore" });
    started = true;
    const fs = await import("node:fs/promises");
    const migrations = (await fs.readdir(new URL("../drizzle/", import.meta.url))).filter(name => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      const source = await fs.readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
      sql(dbUrl, source.replaceAll("--> statement-breakpoint", ""));
    }
    sql(dbUrl, fixture);

    process.env.NODE_ENV = "production";
    process.env.EHO_TEST_DATABASE_DRIVER = "pg";
    process.env.DATABASE_URL = dbUrl;
    const databaseClient = await import("../src/server/db/client.ts");
    assert.throws(() => databaseClient.getDb(), /NODE_ENV=test/);
    process.env.NODE_ENV = "test";
    process.env.AUTH_SESSION_SECRET = secret;
    process.env.AUTH_ALLOWED_ORIGINS = "http://localhost:5173";

    const [locations, dashboard, controlledDocuments, library, training, reports, organisation, userAccess, document] = await Promise.all([
      import("../api/locations.ts"),
      import("../api/dashboard.ts"),
      import("../api/controlled-documents.ts"),
      import("../api/library.ts"),
      import("../api/training.ts"),
      import("../api/reports/compliance.ts"),
      import("../api/admin/organisation.ts"),
      import("../api/admin/user-access.ts"),
      import("../api/documents/[id].ts"),
    ]).then(modules => modules.map(module => module.default));

    const request = (sessionName, query = {}) => ({ method: "GET", query, headers: { cookie: cookie(token(sessionName)) } });
    const managerA = session => request("manager-a", session);
    const adminA = session => request("admin-a", session);
    const adminB = session => request("admin-b", session);

    const locationsA = await invoke(locations, managerA());
    assert.equal(locationsA.status, 200);
    assert.deepEqual(locationsA.body.locations.map(item => item.id), [ids.storeA1]);
    const locationsAdminA = await invoke(locations, adminA());
    assert.equal(locationsAdminA.status, 200);
    assert.deepEqual(locationsAdminA.body.locations.map(item => item.id).sort(), [ids.storeA1, ids.storeA2].sort());
    const locationsB = await invoke(locations, adminB());
    assert.equal(locationsB.status, 200);
    assert.deepEqual(locationsB.body.locations.map(item => item.id), [ids.storeB1]);
    assert(!locationsAdminA.body.locations.some(item => item.id === ids.storeB1));

    const dashboardA = await invoke(dashboard, managerA({ locationId: ids.storeA1 }));
    assert.equal(dashboardA.status, 200);
    assert.equal(dashboardA.body.location.id, ids.storeA1);
    assert.equal((await invoke(dashboard, managerA({ locationId: ids.storeA2 }))).status, 403);
    assert.equal((await invoke(dashboard, managerA({ locationId: ids.storeB1 }))).status, 403);

    const controlledA = await invoke(controlledDocuments, managerA({ locationId: ids.storeA1 }));
    assert.equal(controlledA.status, 200);
    assert.deepEqual(controlledA.body.data.map(item => item.title), ["Controlled A"]);
    assert.equal((await invoke(controlledDocuments, managerA({ locationId: ids.storeA2 }))).status, 403);
    assert.equal((await invoke(controlledDocuments, managerA({ locationId: ids.storeB1 }))).status, 403);
    assert.equal((await invoke(controlledDocuments, adminB({ locationId: ids.storeA1 }))).status, 403);

    const libraryA = await invoke(library, managerA({ locationId: ids.storeA1 }));
    assert.equal(libraryA.status, 200);
    assert.deepEqual(libraryA.body.data.documents.map(item => item.title), ["Library A"]);
    assert.equal((await invoke(library, managerA({ locationId: ids.storeA2 }))).status, 403);
    assert.equal((await invoke(library, managerA({ locationId: ids.storeB1 }))).status, 403);

    assert.equal((await invoke(training, managerA({ locationId: ids.storeA1 }))).status, 200);
    assert.equal((await invoke(training, managerA({ locationId: ids.storeA2 }))).status, 403);
    assert.equal((await invoke(training, managerA({ locationId: ids.storeB1 }))).status, 403);
    assert.equal((await invoke(reports, managerA({ locationId: ids.storeA1, start: "2026-01-01", end: "2026-01-02" }))).status, 200);
    assert.equal((await invoke(reports, managerA({ locationId: ids.storeA2, start: "2026-01-01", end: "2026-01-02" }))).status, 403);
    assert.equal((await invoke(reports, managerA({ locationId: ids.storeB1, start: "2026-01-01", end: "2026-01-02" }))).status, 403);

    assert.equal((await invoke(organisation, adminA())).status, 200);
    assert.equal((await invoke(organisation, adminB())).status, 200);
    assert.equal((await invoke(organisation, managerA())).status, 403);
    assert.equal((await invoke(userAccess, adminA())).status, 200);
    assert.equal((await invoke(userAccess, managerA())).status, 403);

    const missingLocation = await invoke(document, { method: "GET", query: { id: ids.docA }, headers: { cookie: cookie(token("manager-a")) } });
    assert.equal(missingLocation.status, 403);
    const wrongStore = await invoke(document, { method: "GET", query: { id: ids.docA, locationId: ids.storeA2 }, headers: { cookie: cookie(token("manager-a")) } });
    assert.equal(wrongStore.status, 403);
    const wrongOrganisation = await invoke(document, { method: "GET", query: { id: ids.docA, locationId: ids.storeB1 }, headers: { cookie: cookie(token("admin-b")) } });
    assert.equal(wrongOrganisation.status, 403);
    assert.equal(wrongStore.sent, undefined);
    assert.equal(wrongOrganisation.sent, undefined);

    console.log("API tenant isolation passed: real auth sessions, API handlers, service queries, same-org store boundaries, cross-org boundaries and controlled-document allocation");
  } finally {
    if (started && process.env.EHO_TEST_DATABASE_DRIVER === "pg") {
      try { await (await import("../src/server/db/client.ts")).getPool().end(); } catch {}
    }
    if (started) {
      try { run(postgresBin("pg_ctl"), ["--pgdata", dataDir, "--mode", "immediate", "--wait", "stop"], { stdio: "ignore" }); } catch {}
    }
    rmSync(dataDir, { recursive: true, force: true });
  }
};

await test();
