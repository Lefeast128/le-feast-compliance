import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAuthRequestSequence } from "../src/lib/auth-request-sequence.ts";

const sequence = createAuthRequestSequence();
const pendingSessionRead = sequence.capture();
sequence.beginMutation();
assert.equal(sequence.isCurrent(pendingSessionRead), false, "pre-login session bootstrap cannot overwrite successful login state");
const afterLoginSessionRead = sequence.capture();
assert.equal(sequence.isCurrent(afterLoginSessionRead), true);
sequence.beginMutation();
assert.equal(sequence.isCurrent(afterLoginSessionRead), false, "logout/account changes invalidate in-flight session reads");

const [hook, page] = await Promise.all([
  readFile(new URL("../src/hooks/use-auth.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/pages/Auth.tsx", import.meta.url), "utf8"),
]);
assert.match(hook, /requestSequence\.isCurrent\(requestRevision\)/);
assert.match(page, /catch \(requestError\) \{ setError\(safeError\(requestError, fallback\)\); \}/, "genuine authentication failures remain visible");
assert.match(page, /await login\(email\.trim\(\), password\)/);
assert.doesNotMatch(page, /await login\(email\.trim\(\), password\); navigate\(redirect\)/, "successful login uses the authenticated-state redirect once");
console.log("PASS: successful login is protected from stale session bootstrap; genuine errors remain visible");
