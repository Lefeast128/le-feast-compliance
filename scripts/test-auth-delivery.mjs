import assert from "node:assert/strict";
import { handleRequestOtp } from "../api/auth/request-otp.ts";
import { requestOtp } from "../src/server/auth/core.ts";
import { ResendDeliveryError } from "../src/server/auth/resend.ts";

process.env.AUTH_ALLOWED_ORIGINS = "https://le-feast-compliance.vercel.app,http://localhost:5173";
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

const makeResponse = () => {
  const response = {
    statusCode: null,
    body: null,
    status(code) { response.statusCode = code; return response; },
    json(body) { response.body = body; },
  };
  return response;
};

const request = (body, origin = "https://le-feast-compliance.vercel.app") => ({
  method: "POST",
  body,
  headers: origin === null ? {} : { origin },
});

const repo = new MemoryRepository();
const sentCodes = [];
const send = async (_email, code) => { sentCodes.push(code); };

let response = makeResponse();
await handleRequestOtp(request(JSON.stringify({ email: knownUser.email })), response, { repository: repo, send });
assert.equal(response.statusCode, 200);
assert.equal(response.body.ok, true);
assert.equal(repo.challenges.at(-1).invalidatedAt, null);
assert.equal(sentCodes.length, 1);

response = makeResponse();
await handleRequestOtp(request(JSON.stringify({ email: knownUser.email }), "https://evil.example"), response, { repository: new MemoryRepository(), send });
assert.equal(response.statusCode, 403);
assert.equal(response.body.error, "Invalid request origin");

response = makeResponse();
await handleRequestOtp(request(JSON.stringify({ email: "   " })), response, { repository: new MemoryRepository(), send });
assert.equal(response.statusCode, 400);

response = makeResponse();
await handleRequestOtp(request("not-json"), response, { repository: new MemoryRepository(), send });
assert.equal(response.statusCode, 400);
assert.equal(response.body.error, "Invalid JSON");

const deliveryErrors = [
  new ResendDeliveryError({ status: 401, code: "invalid_api_key", safeMessage: "Resend rejected the request" }),
  new ResendDeliveryError({ status: 403, code: "restricted_key", safeMessage: "Sender is not authorized" }),
  new ResendDeliveryError({ status: 422, code: "validation_error", safeMessage: "The sender address is invalid" }),
];
for (const error of deliveryErrors) {
  const failedRepo = new MemoryRepository();
  const logs = [];
  const originalError = console.error;
  console.error = (...args) => logs.push(args);
  response = makeResponse();
  try {
    await handleRequestOtp(request(JSON.stringify({ email: knownUser.email })), response, {
      repository: failedRepo,
      send: async () => { throw error; },
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 502);
  assert.equal(response.body.error, "Unable to send verification email");
  assert.equal(failedRepo.challenges.at(-1).invalidatedAt !== null, true);
  const logText = JSON.stringify(logs);
  assert.equal(logText.includes("invalid_api_key"), error.code === "invalid_api_key");
  assert.equal(logText.includes("123456"), false);
  assert.equal(logText.includes("test-secret"), false);
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
response = makeResponse();
await handleRequestOtp(request(JSON.stringify({ email: knownUser.email })), response, {
  repository: unknownRepo,
  send: async () => { throw new Error("must not send"); },
});
assert.equal(response.statusCode, 200);
assert.equal(response.body.message, "If an account exists, a verification code has been sent.");
assert.equal(unknownRepo.challenges.length, 0);

console.log("Auth delivery tests passed: origin 403, payload 400, Resend 502, safe logging, challenge invalidation, retry, and generic unknown-email response");