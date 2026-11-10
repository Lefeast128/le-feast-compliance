import assert from "node:assert/strict";
process.env.AUTH_OTP_PEPPER ??= "test-pepper";
process.env.AUTH_SESSION_SECRET ??= "test-session-secret";
const { createPasswordCredential, loginWithPassword, PasswordLoginRateLimitError, requestOtp, OTP_IP_MAX_REQUESTS } = await import("../src/server/auth/core.ts");
const { writableDateKey } = await import("../src/server/compliance/structured-task-service.ts");

const credential = createPasswordCredential("correct horse battery staple");
const user = { id: "u1", organisationId: "o1", email: "manager@example.test", name: "M", role: "user", active: true, hasPassword: true, passwordHash: credential.hash, passwordSalt: credential.salt };

// Durable store: login attempts persist via the repository, keyed by account rather than IP.
const attempts = new Map();
const challenges = [];
const repository = {
  findUserByEmail: async email => email === user.email ? user : null,
  findUserById: async () => user,
  listMemberships: async () => [],
  getLatestChallenge: async email => challenges.filter(c => c.normalizedEmail === email).at(-1) ?? null,
  invalidateActiveChallenges: async () => {},
  insertChallenge: async c => { challenges.push(c); },
  updateChallenge: async () => {},
  insertSession: async () => {},
  getSessionByHash: async () => null,
  touchSession: async () => {},
  revokeSession: async () => {},
  setPassword: async () => {},
  revokeUserSessions: async () => {},
  getLoginAttempt: async key => attempts.get(key) ?? null,
  saveLoginAttempt: async (key, value) => { attempts.set(key, value); },
  clearLoginAttempt: async key => { attempts.delete(key); },
  countRecentChallengesByRateLimitKey: async (key, since) => challenges.filter(c => c.rateLimitKey === key && c.createdAt > since).length,
};

for (let i = 0; i < 5; i++) {
  assert.equal(await loginWithPassword(repository, { email: user.email, password: "wrong password!", now: 1000 + i, rateLimitKey: `10.0.0.${i}` }), null);
}
assert.equal(attempts.size, 1, "attempts are stored through the repository under one account key");
await assert.rejects(
  loginWithPassword(repository, { email: user.email, password: "correct horse battery staple", now: 2000, rateLimitKey: "10.9.9.9" }),
  PasswordLoginRateLimitError,
  "changing IP does not bypass the lockout",
);
const after = await loginWithPassword(repository, { email: user.email, password: "correct horse battery staple", now: 2000 + 16 * 60 * 1000, rateLimitKey: "10.9.9.9" });
assert.ok(after?.sessionToken, "lockout expires after the window");
assert.equal(attempts.size, 0, "successful login clears the counter");

// OTP: one IP cannot trigger unlimited verification emails.
let sent = 0;
const send = async () => { sent++; };
for (let i = 0; i < OTP_IP_MAX_REQUESTS + 3; i++) {
  await requestOtp(repository, { email: user.email, now: 10_000 + i * 61_000, rateLimitKey: "203.0.113.5", send });
}
assert.equal(sent, OTP_IP_MAX_REQUESTS, "OTP sends are capped per IP inside the window");
const other = await requestOtp(repository, { email: user.email, now: 10_000 + 20 * 61_000, rateLimitKey: "198.51.100.7", send });
assert.equal(other.ok, true);
assert.equal(sent, OTP_IP_MAX_REQUESTS + 1, "a different IP is unaffected");

// Structured task dates: only today or yesterday in the location's timezone.
const now = Date.parse("2026-07-15T23:30:00Z"); // 00:30 on 16 July in London (BST)
assert.equal(writableDateKey(undefined, "Europe/London", now), "2026-07-16");
assert.equal(writableDateKey("2026-07-15", "Europe/London", now), "2026-07-15");
assert.throws(() => writableDateKey("2026-07-10", "Europe/London", now), /today or yesterday/);
assert.throws(() => writableDateKey("2026-07-17", "Europe/London", now), /today or yesterday/);
assert.throws(() => writableDateKey("16/07/2026", "Europe/London", now), /YYYY-MM-DD/);

console.log("Security hardening tests passed: durable login lockout, OTP IP cap, structured task date guard");
