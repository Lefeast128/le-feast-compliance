import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const setup = await read("src/components/AdminSetup.tsx");
const organisation = await read("src/components/OrganisationAdmin.tsx");
const scopeNotice = await read("src/components/admin/AdminScopeNotice.tsx");
const overview = await read("src/components/admin/AdminStoreOverview.tsx");
const primitives = await read("src/components/admin/AdminPrimitives.tsx");
const service = await read("src/server/management/organisation-service.ts");
const cleaning = await read("src/shared/cleaning-scheduling.ts");

// Scope is explicit in both entry points so an administrator can see where a
// change applies before opening a feature editor.
assert.match(setup, /scope="store"/);
assert.match(setup, /Organisation standards are read-only/);
assert.match(organisation, /scope="organisation"/);
assert.match(organisation, /AllocationImpact/);
assert.match(scopeNotice, /Affected stores/);
assert.match(scopeNotice, /Past responses and completed evidence stay unchanged/);
assert.match(organisation, /taskAllStores/);
assert.match(organisation, /trainingAllStores/);

// Store views distinguish local controls from centrally-owned standards, while
// the existing conditional actions continue to enforce ownership.
assert.match(overview, /Store-only/);
assert.match(overview, /Organisation standard/);
assert.match(primitives, /Store-only/);
assert.match(primitives, /!item\.centralItemId/);

// Publishing remains server-authorised, allocated and versioned rather than a
// UI-only flag or a destructive overwrite.
for (const needle of [
  "requireOrganisationAdmin",
  "selectedLocations",
  "locationIds",
  "db().transaction",
  "retireCentralOperationalTask",
  "central_training_store_added",
]) {
  assert.ok(service.includes(needle), `${needle} missing`);
}

// Schedule labels use the shared weekday rules instead of inventing a second
// due-date implementation in the UI.
assert.match(organisation, /cleaningWeekdaySummary/);
assert.match(organisation, /scheduleLabel/);
assert.match(organisation, /Every \$\{item\.interval/);
assert.match(cleaning, /weekday/);

console.log("Administration simplification tests passed: 22/22");
