import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";

async function canBind(port) {
  const listener = net.createServer();
  return new Promise(resolve => {
    listener.once("error", () => resolve(false));
    listener.listen(port, "127.0.0.1", () => listener.close(() => resolve(true)));
  });
}
let apiPort;
for (let attempt = 0; attempt < 30 && !apiPort; attempt++) {
  const candidate = 40_000 + Math.floor(Math.random() * 19_000);
  if (await canBind(candidate) && await canBind(candidate + 1)) apiPort = candidate;
}
assert.ok(apiPort, "could not find two available loopback ports for isolated API and PostgreSQL");
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const appOrigin = "http://127.0.0.1:5173";
const server = spawn(process.execPath, ["--import=tsx/esm", "scripts/offline-browser-server.mjs"], {
  cwd: process.cwd(),
  env: { ...process.env, EHO_OFFLINE_TEST_API_PORT: String(apiPort), EHO_OFFLINE_TEST_DATABASE_URL: "", EHO_MANAGER_OVERVIEW_FIXTURE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});
let logs = "";
server.stdout.on("data", chunk => { logs += chunk.toString(); process.stdout.write(chunk); });
server.stderr.on("data", chunk => { logs += chunk.toString(); });

async function waitReady() {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Isolated API server exited before readiness:\n${logs}`);
    try {
      const response = await fetch(`${apiOrigin}/__test__/ready`);
      if (response.status === 404) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for isolated API server:\n${logs}`);
}

async function login(email) {
  const response = await fetch(`${apiOrigin}/api/auth/login`, {
    method: "POST",
    headers: { origin: appOrigin, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "offline-test-password" }),
  });
  assert.equal(response.status, 200, `fictional login should succeed for ${email}: ${await response.clone().text()}`);
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie, "real login handler returns an authenticated session cookie");
  return cookie;
}

async function summaries(cookie, query = "") {
  return fetch(`${apiOrigin}/api/manager-overview/stores${query}`, { headers: cookie ? { cookie } : {} });
}
const storeId = store => store.location?.id ?? store.id;
const storeState = store => store.state ?? store.status;
const hasSummary = store => store.summary != null || (storeState(store) === "ready" && typeof store.checksOutstanding === "number");

try {
  await waitReady();
  // Verify the API with sessions established by the real password-login handler.
  const [adminCookie, managerCookie, staffCookie, otherTenantStaffCookie] = await Promise.all([
    login("offline.admin@example.test"),
    login("offline.manager@example.test"),
    login("offline.staff@example.test"),
    login("other.staff@example.test"),
  ]);

  const adminResponse = await summaries(adminCookie);
  assert.equal(adminResponse.status, 200);
  const adminEnvelope = await adminResponse.json();
  assert.equal(adminEnvelope.ok, true);
  const adminPayload = adminEnvelope.data;
  const adminStores = adminPayload.stores;
  const adminIds = adminStores.map(storeId).sort();
  assert.deepEqual(adminIds, [
    "00000000-0000-4000-8000-000000001002", // active store in organisation A
    "00000000-0000-4000-8000-000000001011", // second active store in organisation A
    "00000000-0000-4000-8000-000000001026", // third active store in organisation A
    "00000000-0000-4000-8000-000000001028", // deliberate bad-timezone fixture for partial failure
  ].sort());
  assert(!adminIds.includes("00000000-0000-4000-8000-000000001015"), "organisation admin cannot see another organisation's store");
  assert(!adminIds.includes("00000000-0000-4000-8000-000000001029"), "inactive stores are not included");
  assert(adminStores.some(store => storeState(store) === "ready" && hasSummary(store)), "healthy stores return calculated summaries");
  const failedStore = adminStores.find(store => storeId(store) === "00000000-0000-4000-8000-000000001028");
  assert.equal(storeState(failedStore), "error");
  assert(!hasSummary(failedStore), "failed store does not report false zero counts");

  const managerResponse = await summaries(managerCookie);
  assert.equal(managerResponse.status, 200);
  const managerPayload = (await managerResponse.json()).data;
  assert.deepEqual(managerPayload.stores.map(storeId).sort(), [
    "00000000-0000-4000-8000-000000001011",
    "00000000-0000-4000-8000-000000001026",
  ].sort(), "manager sees only stores with manager memberships");

  for (const cookie of [staffCookie, otherTenantStaffCookie]) {
    const denied = await summaries(cookie);
    assert.equal(denied.status, 403, "staff and foreign-tenant staff are denied manager data");
  }
  assert.equal((await summaries(null)).status, 401, "unauthenticated requests are denied");

  const forged = await summaries(managerCookie, "?locationId=00000000-0000-4000-8000-000000001015&organisationId=00000000-0000-4000-8000-000000000002");
  assert.equal(forged.status, 200);
  const forgedPayload = (await forged.json()).data;
  assert.deepEqual(forgedPayload.stores.map(storeId).sort(), managerPayload.stores.map(storeId).sort(), "forged store/organisation parameters cannot widen server-derived scope");
  assert(!JSON.stringify(forgedPayload).includes("Other Organisation Store"));

  console.log("PASS real authenticated API/PostgreSQL manager overview isolation: organisation admin, manager, staff, anonymous, forged scope and per-store failure");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server.exitCode === null) {
    server.kill("SIGTERM");
    await new Promise(resolve => server.once("exit", resolve));
  }
  if (logs.includes("shmget: Resource temporarily unavailable")) {
    console.error("Local PostgreSQL could not start because the host denied shared-memory resources.");
  }
}
