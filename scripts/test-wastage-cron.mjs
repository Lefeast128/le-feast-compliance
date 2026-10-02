import assert from "node:assert/strict";
import { safeWastageError, wastageErrorCategory } from "../api/cron/wastage-sync.ts";

const privateKey = "-----BEGIN PRIVATE KEY-----\nsecret-material\n-----END PRIVATE KEY-----";
const error = new Error(`Google request failed authorization: Bearer otp-secret private_key=${privateKey}`);
const safe = safeWastageError(error);

assert.ok(!safe.includes("secret-material"));
assert.ok(!safe.includes("otp-secret"));
assert.ok(!safe.includes("BEGIN PRIVATE KEY"));
assert.equal(wastageErrorCategory(new Error("Google Sheets configuration is missing: GOOGLE_SHEETS_PRIVATE_KEY")), "configuration");
assert.equal(wastageErrorCategory(new Error("Google Sheet has unexpected wastage headers")), "sheet_headers");
assert.equal(wastageErrorCategory(new Error("Google Sheet contains duplicate wastage row")), "sheet_duplicates");
assert.equal(wastageErrorCategory(new Error("request timed out")), "timeout");

console.log("Wastage cron safe logging tests passed");
