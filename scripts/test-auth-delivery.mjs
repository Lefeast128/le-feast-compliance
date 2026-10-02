import assert from "node:assert/strict";
import fs from "node:fs";
import { requestOtp } from "../src/server/auth/core.ts";
import { ResendDeliveryError, toResendDeliveryError } from "../src/server/auth/resend.ts";

process.env.AUTH_OTP_PEPPER = "test-only-otp-pepper";

const knownUser = {
  id: "user-1",
  organisationId: "org-1",
  email: "brenden@lefeast.co.uk",
  name: "Brenden",
  role: "admin",
};

class MemoryRepository {
  challenges = [];
  users = [knownUser];

  async findUserByEmail(email) { return this.users.find(item => item.email === email) ?? null; }
  async findUserById() { return knownUser; }
  async listMemberships() { return []; }
  async getLatestChallenge(email) {
    return [...this.challenges]
      .filter(item => item.normalizedEmail === email)
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  }
  async invalidateActiveChallenges(email, at) {
    this.challenges
      .filter(item => item.normalizedEmail === email && !item.consumedAt && !item.invalidatedAt)
      .forEach(item => { item.invalidatedAt = at; });
  }
  async insertChallenge(challenge) { this.challenges.push(structuredClone(challenge)); }
  async updateChallenge(id, patch) { Object.assign(this.challenges.find(item => item.id === id), patch); }
  async insertSession() {}
  async getSessionByHash() { return null; }
  async touchSession() {}
  async revokeSession() {}
}

const routeSource = fs.readFileSync(new URL("../api/auth/request-otp.ts", import.meta.url), "utf8");
for (const specifier of [
  "../../src/server/auth/cookies.js",
  "../../src/server/auth/core.js",
  "../../src/server/auth/resend.js",
  "../../src/server/auth/drizzle-repository.js",
]) {
  assert.equal(routeSource.includes(specifier), true, `request-otp route must use production runtime import ${specifier}`);
}
assert.equal(routeSource.includes("../../src/server/auth/cookies.ts"), false);
assert.equal(routeSource.includes("../../src/server/auth/core.ts"), false);
assert.equal(routeSource.includes("../../src/server/auth/resend.ts"), false);
assert.equal(routeSource.includes("../../src/server/auth/drizzle-repository.ts"), false);
for (const status of [400, 403, 405, 500, 502]) assert.match(routeSource, new RegExp(`res\\.status\\(${status}\\)`));

const repo = new MemoryRepository();
const sentCodes = [];
await requestOtp(repo, {
  email: knownUser.email,
  send: async (_email, code) => { sentCodes.push(code); },
});
assert.equal(repo.challenges.at(-1).invalidatedAt, null);
assert.equal(sentCodes.length, 1);

for (const error of [
  new ResendDeliveryError({ status: 401, code: "invalid_api_key", safeMessage: "Resend rejected the request" }),
  new ResendDeliveryError({ status: 403, code: "restricted_key", safeMessage: "Sender is not authorized" }),
  new ResendDeliveryError({ status: 422, code: "validation_error", safeMessage: "The sender address is invalid" }),
]) {
  const failedRepo = new MemoryRepository();
  await assert.rejects(
    requestOtp(failedRepo, {
      email: knownUser.email,
      send: async () => { throw error; },
    }),
    error,
  );
  assert.notEqual(failedRepo.challenges.at(-1).invalidatedAt, null);
}

const failedRepo = new MemoryRepository();
await assert.rejects(
  requestOtp(failedRepo, {
    email: knownUser.email,
    now: 10_000,
    send: async () => { throw new ResendDeliveryError({ status: 502, safeMessage: "delivery failed" }); },
  }),
);
assert.notEqual(failedRepo.challenges[0].invalidatedAt, null);
let retried = false;
await requestOtp(failedRepo, {
  email: knownUser.email,
  now: 10_001,
  send: async () => { retried = true; },
});
assert.equal(retried, true);

const unknownRepo = new MemoryRepository();
unknownRepo.users = [];
let unknownSendCalled = false;
const unknownResponse = await requestOtp(unknownRepo, {
  email: knownUser.email,
  send: async () => { unknownSendCalled = true; },
});
assert.equal(unknownResponse.message, "If an account exists, a verification code has been sent.");
assert.equal(unknownRepo.challenges.length, 0);
assert.equal(unknownSendCalled, false);

const sanitized = toResendDeliveryError({
  isAxiosError: true,
  response: {
    status: 422,
    data: {
      code: "validation_error",
      message: "Bearer re_test-secret 123456",
    },
  },
});
assert.equal(sanitized.status, 422);
assert.equal(sanitized.code, "validation_error");
assert.equal(sanitized.safeMessage.includes("re_test-secret"), false);
assert.equal(sanitized.safeMessage.includes("123456"), false);

console.log("Auth delivery tests passed: production .js imports, route status mapping, safe Resend errors, challenge invalidation, immediate retry, and generic unknown-email response");
