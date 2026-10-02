import assert from "node:assert/strict";
import { safeWastageError, wastageErrorCategory } from "../api/cron/wastage-sync.ts";

const privateKey = "-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----";
const error = new Error(`Google request failed authorization: Bearer otp-secret private_key=${privateKey}`);
const safe = safeWastageError(error);

assert.ok(!safe.includes("secret-material"));
assert.ok(!safe.includes("otp-secret"));
assert.ok(!safe.includes("BEGIN PRIVATE KEY"));
assert.equal(wastageErrorCategory(new Error("Google Workload Identity configuration is missing: GCP_PROJECT_ID")), "configuration");
assert.equal(wastageErrorCategory(new Error("Google Sheet has unexpected wastage headers")), "sheet_headers");
assert.equal(wastageErrorCategory(new Error("Google Sheet contains duplicate wastage row")), "sheet_duplicates");
assert.equal(wastageErrorCategory(new Error("request timed out")), "timeout");
assert.equal(wastageErrorCategory(new Error("Vercel OIDC token exchange failed")), "oidc_token_exchange_failed");
assert.equal(wastageErrorCategory(new Error("Google Workload Identity authentication could not be initialized")), "google_auth");
assert.equal(wastageErrorCategory(new Error("Google Sheets permission denied")), "google_permission_denied");

console.log("Wastage cron safe logging tests passed");
