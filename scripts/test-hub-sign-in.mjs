import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyHubPass, hubAccountEmail } from "../src/server/auth/hub-pass.ts";
import { createSessionForUser, hashSessionToken } from "../src/server/auth/core.ts";
import { hubSessionCookie, clearHubSessionCookie } from "../src/server/auth/cookies.ts";

const secret = "s".repeat(40);
const b64 = (v) => Buffer.from(v).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const make = (claims, key = secret) => {
  const body = b64(JSON.stringify(claims));
  return body + "." + b64(createHmac("sha256", key).update(body).digest());
};
const now = 1_800_000_000_000;
const t = Math.floor(now / 1000);
const good = { v: 1, app: "eho", store: "bolton", role: "manager", iat: t, exp: t + 120 };

assert.deepEqual(verifyHubPass(make(good), "eho", { secret, now }), { ok: true, store: "bolton", role: "manager" });
assert.equal(verifyHubPass(make(good, "x".repeat(40)), "eho", { secret, now }).ok, false, "wrong key");
assert.equal(verifyHubPass(make({ ...good, app: "sales" }), "eho", { secret, now }).ok, false, "wrong app");
assert.equal(verifyHubPass(make({ ...good, exp: t - 1 }), "eho", { secret, now }).ok, false, "expired");
assert.equal(verifyHubPass(make({ ...good, exp: t + 3600 }), "eho", { secret, now }).ok, false, "too long-lived");
assert.equal(verifyHubPass(make({ ...good, role: "admin" }), "eho", { secret, now }).ok, false, "unknown role");
assert.equal(verifyHubPass(make(good), "eho", { secret: "", now }).ok, false, "not configured");
assert.equal(verifyHubPass(undefined, "eho", { secret, now }).ok, false, "missing pass");

const accounts = JSON.stringify({ "bolton:manager": "manager@example.com", "bolton:staff": "staff@example.com" });
assert.equal(hubAccountEmail({ ok: true, store: "bolton", role: "manager" }, accounts), "manager@example.com");
assert.equal(hubAccountEmail({ ok: true, store: "bolton", role: "staff" }, accounts), "staff@example.com");
assert.equal(hubAccountEmail({ ok: true, store: "rochdale", role: "staff" }, accounts), null, "unmapped store");
assert.equal(hubAccountEmail({ ok: false, error: "x" }, accounts), null, "failed pass");
assert.equal(hubAccountEmail({ ok: true, store: "bolton", role: "staff" }, "not json"), null, "bad config");

const users = {
  "manager@example.com": { id: "u1", organisationId: "o1", email: "manager@example.com", name: "M", role: "user", hasPassword: true, active: true },
  "gone@example.com": { id: "u2", organisationId: "o1", email: "gone@example.com", name: "G", role: "user", hasPassword: true, active: false },
};
const sessions = [];
const repository = { findUserByEmail: async (e) => users[e] ?? null, insertSession: async (s) => { sessions.push(s); } };
const created = await createSessionForUser(repository, { email: " Manager@Example.com ", now, sessionSecret: secret });
assert.equal(created.user.id, "u1");
assert.equal(sessions.length, 1);
assert.equal(sessions[0].tokenHash, hashSessionToken(created.sessionToken, secret));
assert.equal(await createSessionForUser(repository, { email: "gone@example.com", now, sessionSecret: secret }), null, "inactive user");
assert.equal(await createSessionForUser(repository, { email: "nobody@example.com", now, sessionSecret: secret }), null, "unknown user");

assert.match(hubSessionCookie("abc", 60), /SameSite=None; Partitioned/);
assert.match(hubSessionCookie("abc", 60), /Secure/);
assert.match(clearHubSessionCookie(), /Max-Age=0.*Partitioned/);

console.log("hub sign-in tests passed");
