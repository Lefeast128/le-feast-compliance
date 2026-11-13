import assert from "node:assert/strict";
import { assertMutationOrigin, allowedOrigins } from "../src/server/auth/cookies.ts";
import requestOtp from "../api/auth/request-otp.ts";
import login from "../api/auth/login.ts";
import verifyOtp from "../api/auth/verify-otp.ts";

const saved = {
  authAllowedOrigins: process.env.AUTH_ALLOWED_ORIGINS,
  vercelEnv: process.env.VERCEL_ENV,
  vercelUrl: process.env.VERCEL_URL,
  vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
};
delete process.env.VERCEL_BRANCH_URL;

function response() {
  return {
    code: 200,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
    setHeader() {},
  };
}

try {
  const previewOrigin = "https://le-feast-compliance-test-abc-lefeast128s-projects.vercel.app";
  process.env.AUTH_ALLOWED_ORIGINS = "https://eho.lefeast.co.uk";
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = previewOrigin.slice("https://".length);
  assert.deepEqual(allowedOrigins(), ["https://eho.lefeast.co.uk", previewOrigin]);
  assert.doesNotThrow(() => assertMutationOrigin({ headers: { origin: previewOrigin } }));
  assert.throws(() => assertMutationOrigin({ headers: { origin: "https://attacker.vercel.app", "x-forwarded-host": "le-feast-compliance.vercel.app" } }), /Invalid request origin/);

  process.env.VERCEL_ENV = "production";
  assert.throws(() => assertMutationOrigin({ headers: { origin: previewOrigin } }), /Invalid request origin/);
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_URL = "attacker.example.org";
  assert.throws(() => assertMutationOrigin({ headers: { origin: "https://attacker.example.org" } }), /Invalid request origin/);

  process.env.VERCEL_URL = previewOrigin.slice("https://".length);
  const branchOrigin = "https://le-feast-compliance-git-claude-audit-fixes-lefeast128s-projects.vercel.app";
  process.env.VERCEL_BRANCH_URL = branchOrigin.slice("https://".length);
  assert.deepEqual(allowedOrigins(), ["https://eho.lefeast.co.uk", previewOrigin, branchOrigin], "preview accepts its branch alias");
  assert.doesNotThrow(() => assertMutationOrigin({ headers: { origin: branchOrigin } }));
  process.env.VERCEL_ENV = "production";
  assert.throws(() => assertMutationOrigin({ headers: { origin: branchOrigin } }), /Invalid request origin/, "production ignores preview aliases");
  process.env.VERCEL_ENV = "preview";
  process.env.VERCEL_BRANCH_URL = "evil.example.org";
  assert.throws(() => assertMutationOrigin({ headers: { origin: "https://evil.example.org" } }), /Invalid request origin/, "non-vercel.app branch URL is ignored");
  delete process.env.VERCEL_BRANCH_URL;

  const req = { method: "POST", headers: { origin: previewOrigin }, body: {} };
  const otpResponse = response();
  await requestOtp(req, otpResponse);
  assert.equal(otpResponse.code, 400);
  assert.equal(otpResponse.body.error, "Email is required");

  const loginResponse = response();
  await login(req, loginResponse);
  assert.equal(loginResponse.code, 401);
  assert.equal(loginResponse.body.error, "Invalid email or password");

  const callbackResponse = response();
  await verifyOtp(req, callbackResponse);
  assert.equal(callbackResponse.code, 400);
  assert.equal(callbackResponse.body.error, "Email and code are required");

  const rejected = { ...req, headers: { origin: "https://not-the-deployment.vercel.app" } };
  const rejectedOtp = response();
  await requestOtp(rejected, rejectedOtp);
  assert.equal(rejectedOtp.code, 403);
  const rejectedLogin = response();
  await login(rejected, rejectedLogin);
  assert.equal(rejectedLogin.code, 403);
  const rejectedCallback = response();
  await verifyOtp(rejected, rejectedCallback);
  assert.equal(rejectedCallback.code, 403);

  console.log("PASS auth origin policy: exact Vercel Preview origin is accepted; forged/production origins remain rejected; OTP initiation and callback enforce the policy");
} finally {
  for (const [key, value] of Object.entries({ AUTH_ALLOWED_ORIGINS: saved.authAllowedOrigins, VERCEL_ENV: saved.vercelEnv, VERCEL_URL: saved.vercelUrl, VERCEL_BRANCH_URL: saved.vercelBranchUrl })) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
