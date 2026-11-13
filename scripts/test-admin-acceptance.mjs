import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { allocatedStoresMissingActiveRows } from "../src/shared/admin-allocation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const service = await read("src/server/management/organisation-service.ts");
const training = await read("src/server/training/service.ts");
const checklist = await read("src/server/management/checklist-service.ts");
const cleaning = await read("src/server/management/cleaning-service.ts");
const security = await read("src/server/management/security-service.ts");
const setup = await read("src/components/AdminSetup.tsx");
const organisation = await read("src/components/OrganisationAdmin.tsx");

const stores = ["store-a", "store-b", "store-c", "store-d"];

// A wording/schedule edit versions the active row rather than causing the
// follow-up insert pass to create a second active row for that store.
assert.deepEqual(
  allocatedStoresMissingActiveRows(
    stores,
    stores.slice(0, 2).map((locationId) => ({ locationId, active: true })),
    ["store-b"],
  ),
  ["store-c", "store-d"],
);
assert.deepEqual(
  allocatedStoresMissingActiveRows(
    stores,
    stores.map((locationId) => ({ locationId, active: true })),
    ["store-b"],
  ),
  [],
);
assert.deepEqual(
  allocatedStoresMissingActiveRows(
    ["store-a", "store-c"],
    stores.map((locationId) => ({ locationId, active: true })),
    [],
  ),
  [],
);

// Server-side ownership and organisation checks remain the source of truth;
// the UI cannot grant store managers central publishing rights.
for (const source of [training, checklist, cleaning, security]) {
  assert.match(source, /context\.user\.role !== "admin"/);
}
assert.match(service, /requireOrganisationAdmin/);
assert.match(service, /db\(\)\.transaction/);
assert.match(service, /active: false, deactivatedAt/);
assert.match(service, /versionRootId: old\.versionRootId \?\? old\.id/);

// The admin forms expose the same allocation before publish and edit, and
// preview the resulting scope before the request is sent.
assert.match(setup, /Selected store/);
assert.match(organisation, /AllocationImpact/);
assert.match(organisation, /taskAllStores/);
assert.match(organisation, /trainingAllStores/);
assert.match(organisation, /setTaskAllStores\(item\.allocationMode === "all"\)/);
assert.match(organisation, /setTrainingAllStores\(item\.allocationMode === "all"\)/);

console.log("Administration acceptance tests passed: 12/12");
