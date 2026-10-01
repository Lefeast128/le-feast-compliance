import assert from "node:assert/strict";
import {
  authenticateSession,
  getAuthContext,
  isAllowedOrigin,
  normalizeEmail,
  requestOtp,
  requireLocationAccess,
  requireLocationManager,
  logoutSession,
  verifyOtp,
} from "../src/server/auth/core.ts";

process.env.AUTH_OTP_PEPPER = "test-only-otp-pepper";
process.env.AUTH_SESSION_SECRET = "test-only-session-secret";

const user = (id, role = "user", organisationId = "org-1") => ({ id, organisationId, email: `${id}@example.test`, name: id, role });

class MemoryRepository {
  users = [user("staff"), user("manager"), user("admin", "admin"), user("other-admin", "admin", "org-2")];
  memberships = [
    { userId: "staff", locationId: "blackpool", role: "staff" },
    { userId: "manager", locationId: "blackpool", role: "manager" },
  ];
  challenges = [];
  sessions = [];
  async findUserByEmail(email) { return this.users.find(item => item.email === email) ?? null; }
  async findUserById(id) { return this.users.find(item => item.id === id) ?? null; }
  async listMemberships(userId) { return this.memberships.filter(item => item.userId === userId); }
  async getLatestChallenge(email) { return [...this.challenges].filter(item => item.normalizedEmail === email).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null; }
  async invalidateActiveChallenges(email, at) { this.challenges.filter(item => item.normalizedEmail === email && !item.consumedAt && !item.invalidatedAt).forEach(item => { item.invalidatedAt = at; }); }
  async insertChallenge(challenge) { this.challenges.push(structuredClone(challenge)); }
  async updateChallenge(id, patch) { Object.assign(this.challenges.find(item => item.id === id), patch); }
  async insertSession(session) { this.sessions.push(structuredClone(session)); }
  async getSessionByHash(hash) { return this.sessions.find(item => item.tokenHash === hash) ?? null; }
  async touchSession(id, at) { const session = this.sessions.find(item => item.id === id); if (session) session.lastUsedAt = at; }
  async revokeSession(id, at) { const session = this.sessions.find(item => item.id === id); if (session) session.revokedAt = at; }
}

const repository = new MemoryRepository();
assert.equal(normalizeEmail("  Staff@Example.Test "), "staff@example.test");

let sentCode = null;
const send = async (_email, code) => { sentCode = code; };
const unknown = await requestOtp(repository, { email: "unknown@example.test", now: 1_000, send });
assert.deepEqual(unknown, { ok: true, message: "If an account exists, a verification code has been sent." });
assert.equal(repository.challenges.length, 0);

await requestOtp(repository, { email: "staff@example.test", now: 2_000, send });
assert.match(sentCode, /^\d{6}$/);
assert.equal(repository.challenges[0].otpDigest.includes(sentCode), false);
const firstChallengeId = repository.challenges[0].id;
const wrong = await verifyOtp(repository, { email: "staff@example.test", code: "000000", now: 3_000 });
assert.equal(wrong, null);
assert.equal(repository.challenges[0].failedAttempts, 1);
const verified = await verifyOtp(repository, { email: "staff@example.test", code: sentCode, now: 4_000 });
assert.ok(verified?.sessionToken);
assert.equal(repository.sessions[0].tokenHash.includes(verified.sessionToken), false);
assert.equal(repository.challenges[0].consumedAt, 4_000);
assert.equal(await verifyOtp(repository, { email: "staff@example.test", code: sentCode, now: 5_000 }), null);

await requestOtp(repository, { email: "manager@example.test", now: 10_000, send });
const expiredCode = sentCode;
assert.equal(await verifyOtp(repository, { email: "manager@example.test", code: expiredCode, now: 10_000 + 10 * 60 * 1000 }), null);

await requestOtp(repository, { email: "manager@example.test", now: 20_000, send });
const attemptCode = sentCode;
for (let attempt = 0; attempt < 5; attempt += 1) {
  assert.equal(await verifyOtp(repository, { email: "manager@example.test", code: "111111", now: 21_000 + attempt }), null);
}
assert.equal(repository.challenges.find(item => item.normalizedEmail === "manager@example.test").invalidatedAt, 21_004);

await requestOtp(repository, { email: "manager@example.test", now: 100_000, send });
const oldChallengeId = repository.challenges.find(item => item.normalizedEmail === "manager@example.test" && item.createdAt === 100_000).id;
await requestOtp(repository, { email: "manager@example.test", now: 100_000 + 60 * 1000 + 1, send });
assert.equal(repository.challenges.find(item => item.id === oldChallengeId).invalidatedAt, 160_001);
assert.notEqual(repository.challenges.find(item => item.normalizedEmail === "manager@example.test" && item.createdAt === 160_001)?.id, oldChallengeId);

const staffContext = await getAuthContext(repository, repository.users[0]);
const managerContext = await getAuthContext(repository, repository.users[1]);
const adminContext = await getAuthContext(repository, repository.users[2]);
const otherAdminContext = await getAuthContext(repository, repository.users[3]);
assert.doesNotThrow(() => requireLocationAccess(staffContext, "blackpool", "org-1"));
assert.throws(() => requireLocationManager(staffContext, "blackpool", "org-1"));
assert.doesNotThrow(() => requireLocationManager(managerContext, "blackpool", "org-1"));
assert.throws(() => requireLocationAccess(managerContext, "bolton", "org-1"));
assert.doesNotThrow(() => requireLocationAccess(adminContext, "bolton", "org-1"));
assert.throws(() => requireLocationAccess(adminContext, "other", "org-2"));

const sessionUser = await authenticateSession(repository, verified.sessionToken, { now: 6_000 });
assert.equal(sessionUser?.id, "staff");
await logoutSession(repository, verified.sessionToken, { now: 7_000 });
assert.equal(await authenticateSession(repository, verified.sessionToken, { now: 8_000 }), null);
await requestOtp(repository, { email: "staff@example.test", now: 200_000, send });
const expiredSession = await verifyOtp(repository, { email: "staff@example.test", code: sentCode, now: 201_000 });
assert.ok(expiredSession?.sessionToken);
assert.equal(await authenticateSession(repository, expiredSession.sessionToken, { now: 201_000 + 31 * 24 * 60 * 60 * 1000 }), null);
assert.equal(isAllowedOrigin("https://evil.example", ["https://le-feast-compliance.vercel.app"]), false);
assert.equal(isAllowedOrigin("https://le-feast-compliance.vercel.app", ["https://le-feast-compliance.vercel.app"]), true);

console.log("Auth tests passed: 22/22");
