import assert from "node:assert/strict";
import { createPasswordCredential, loginWithPassword, setPassword, verifyPassword, validatePassword } from "../src/server/auth/core.ts";

process.env.AUTH_SESSION_SECRET = "test-password-session-secret";

class MemoryRepository {
  users = [{ id: "admin", organisationId: "org-1", email: "admin@example.test", name: "Admin", role: "admin", hasPassword: false, passwordHash: null, passwordSalt: null }];
  sessions = [];
  async findUserByEmail(email) { return this.users.find(user => user.email === email) ?? null; }
  async findUserById(id) { return this.users.find(user => user.id === id) ?? null; }
  async listMemberships() { return []; }
  async insertSession(session) { this.sessions.push(structuredClone(session)); }
  async getSessionByHash(hash) { return this.sessions.find(session => session.tokenHash === hash) ?? null; }
  async touchSession() {}
  async revokeSession(id, at) { const session = this.sessions.find(item => item.id === id); if (session) session.revokedAt = at; }
  async setPassword(id, credential) {
    const user = this.users.find(item => item.id === id);
    user.passwordHash = credential.hash;
    user.passwordSalt = credential.salt;
    user.hasPassword = true;
  }
  async revokeUserSessions(id, at) { this.sessions.filter(session => session.userId === id && !session.revokedAt).forEach(session => { session.revokedAt = at; }); }
}

const repository = new MemoryRepository();
assert.throws(() => validatePassword("short"), /at least 10/);
const credential = createPasswordCredential("correct horse battery staple");
assert.notEqual(credential.hash, "correct horse battery staple");
assert.notEqual(credential.salt, "correct horse battery staple");
await repository.setPassword("admin", credential, 1);
const user = await repository.findUserById("admin");
assert.equal(verifyPassword("correct horse battery staple", user), true);
assert.equal(verifyPassword("wrong password", user), false);

const first = await loginWithPassword(repository, { email: "admin@example.test", password: "correct horse battery staple", now: 1000, rateLimitKey: "test-login-1" });
assert.ok(first?.sessionToken);
assert.equal(repository.sessions.length, 1);
assert.equal(await loginWithPassword(repository, { email: "admin@example.test", password: "wrong password", now: 2000, rateLimitKey: "test-login-2" }), null);
assert.equal(await loginWithPassword(repository, { email: "missing@example.test", password: "correct horse battery staple", now: 3000, rateLimitKey: "test-login-3" }), null);

const replacement = await setPassword(repository, "admin", "new correct horse battery", { now: 4000 });
assert.ok(replacement?.sessionToken);
assert.equal(repository.sessions[0].revokedAt, 4000);
assert.equal(await loginWithPassword(repository, { email: "admin@example.test", password: "correct horse battery staple", now: 5000, rateLimitKey: "test-login-4" }), null);
assert.ok(await loginWithPassword(repository, { email: "admin@example.test", password: "new correct horse battery", now: 6000, rateLimitKey: "test-login-5" }));

console.log("Password authentication tests passed: 18/18");
