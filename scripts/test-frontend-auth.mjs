import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ApiError, authApi } from "../src/lib/api-client.ts";

const source = async path => readFile(new URL(path, import.meta.url), "utf8");
const calls = [];
const responses = [];
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  calls.push({ input, init });
  const next = responses.shift();
  if (!next) throw new Error("Missing mocked response");
  return new Response(next.body, {
    status: next.status,
    headers: { "Content-Type": "application/json" },
  });
};

try {
  responses.push({ status: 200, body: JSON.stringify({ authenticated: false }) });
  const unauthenticated = await authApi.getSession();
  assert.deepEqual(unauthenticated, { authenticated: false });
  assert.equal(calls.at(-1).init.credentials, "include");

  responses.push({
    status: 200,
    body: JSON.stringify({
      authenticated: true,
      user: { id: "user-1", organisationId: "org-1", email: "staff@example.test", name: "Staff", role: "user" },
      memberships: [{ userId: "user-1", locationId: "location-1", role: "staff" }],
    }),
  });
  const authenticated = await authApi.getSession();
  assert.equal(authenticated.authenticated, true);
  assert.equal(authenticated.memberships[0].role, "staff");

  responses.push({ status: 200, body: JSON.stringify({ ok: true, message: "If an account exists, a verification code has been sent." }) });
  assert.equal((await authApi.requestOtp("staff@example.test")).ok, true);
  assert.equal(calls.at(-1).init.method, "POST");

  responses.push({ status: 502, body: JSON.stringify({ ok: false, error: "Unable to send verification email" }) });
  await assert.rejects(authApi.requestOtp("staff@example.test"), error => {
    assert(error instanceof ApiError);
    assert.equal(error.status, 502);
    assert.equal(error.message, "Unable to send verification email");
    return true;
  });

  responses.push({
    status: 200,
    body: JSON.stringify({
      ok: true,
      user: { id: "user-1", organisationId: "org-1", email: "staff@example.test", name: "Staff", role: "user" },
      memberships: [],
    }),
  });
  const verified = await authApi.verifyOtp("staff@example.test", "123456");
  assert.equal(verified.ok, true);
  assert.equal(JSON.parse(calls.at(-1).init.body).code, "123456");

  responses.push({ status: 401, body: JSON.stringify({ ok: false, error: "Invalid or expired verification code" }) });
  await assert.rejects(authApi.verifyOtp("staff@example.test", "000000"), error => {
    assert(error instanceof ApiError);
    assert.equal(error.status, 401);
    return true;
  });

  responses.push({ status: 200, body: JSON.stringify({ ok: true }) });
  assert.equal((await authApi.logout()).ok, true);

  const hook = await source("../src/hooks/use-auth.ts");
  const authPage = await source("../src/pages/Auth.tsx");
  const requireAuth = await source("../src/components/RequireAuth.tsx");
  assert.match(hook, /authApi\.getSession/);
  assert.match(hook, /authApi\.requestOtp/);
  assert.match(hook, /authApi\.verifyOtp/);
  assert.match(hook, /authApi\.logout/);
  assert.doesNotMatch(hook, /localStorage|sessionStorage|signIn\(|signOut\(/);
  assert.doesNotMatch(authPage, /@convex-dev\/auth|convex\/react|signIn\(|anonymous|demo access/);
  assert.match(requireAuth, /isLoading/);
  assert.match(requireAuth, /!isAuthenticated/);
  assert.match(requireAuth, /return children/);

  console.log("Frontend auth tests passed: 12/12");
} finally {
  globalThis.fetch = originalFetch;
}
