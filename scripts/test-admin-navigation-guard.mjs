import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { shouldConfirmAppNavigation } from "../src/lib/navigation-guard.ts";

assert.equal(shouldConfirmAppNavigation({ activeWorkflow: false, adminHasUnsavedChanges: false, submissionInFlight: false, pendingMutations: 0 }), false, "clean Admin navigation does not warn");
assert.equal(shouldConfirmAppNavigation({ activeWorkflow: false, adminHasUnsavedChanges: true, submissionInFlight: false, pendingMutations: 0 }), true, "unsaved Admin changes still warn");
assert.equal(shouldConfirmAppNavigation({ activeWorkflow: false, adminHasUnsavedChanges: false, submissionInFlight: true, pendingMutations: 0 }), true, "in-flight operational work still blocks navigation");
assert.equal(shouldConfirmAppNavigation({ activeWorkflow: false, adminHasUnsavedChanges: false, submissionInFlight: false, pendingMutations: 1 }), true, "pending mutations still block navigation");

const [dashboard, admin] = await Promise.all([
  readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/AdminSetup.tsx", import.meta.url), "utf8"),
]);
assert.match(dashboard, /adminHasUnsavedChanges/);
assert.doesNotMatch(dashboard, /\|\| view === "admin" \|\|/);
assert.match(admin, /onDirtyChange/);
console.log("PASS: clean Admin exit is direct; dirty forms and active submissions remain guarded");
