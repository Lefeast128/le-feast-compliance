import assert from "node:assert/strict";
import { assertControlledDocumentAccess } from "../src/server/documents/access.ts";
import { requireLocationAccess, requireLocationManager, requireOrganisationAdmin } from "../src/server/auth/core.ts";

const orgA = "org-a";
const orgB = "org-b";
const contextA = {
  user: { id: "user-a", organisationId: orgA, role: "user", active: true },
  memberships: [{ userId: "user-a", locationId: "store-a", role: "manager" }],
};
const adminA = {
  user: { id: "admin-a", organisationId: orgA, role: "admin", active: true },
  memberships: [],
};

assert.doesNotThrow(() => requireLocationAccess(contextA, "store-a", orgA));
assert.doesNotThrow(() => requireLocationManager(contextA, "store-a", orgA));
assert.throws(() => requireLocationAccess(contextA, "store-b", orgB), /Location access required/);
assert.throws(() => requireLocationManager(contextA, "store-b", orgB), /Location manager access required/);
assert.doesNotThrow(() => requireOrganisationAdmin(adminA, orgA));
assert.throws(() => requireOrganisationAdmin(adminA, orgB), /Organisation admin access required/);

const allocatedToA = { organisationId: orgA, allocationMode: "selected", locationIds: ["store-a"] };
assert.doesNotThrow(() => assertControlledDocumentAccess(allocatedToA, "store-a", orgA));
assert.throws(() => assertControlledDocumentAccess(allocatedToA, "store-b", orgA), /Document access denied/);
assert.throws(() => assertControlledDocumentAccess(allocatedToA, "store-a", orgB), /Document access denied/);
assert.throws(() => assertControlledDocumentAccess(allocatedToA, undefined, orgA), /Document location is required/);

console.log("Multi-tenant isolation fixture passed: organisation, store, manager, admin and controlled-document boundaries");
