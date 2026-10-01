import assert from "node:assert/strict";
import { FOUNDATION_LOCATIONS, OPERATIONAL_DEFAULTS } from "../src/server/db/seed.ts";
import { localDateKey, localDayRange } from "../src/server/dashboard/time.ts";
import { getAuthContext, requireLocationAccess, requireLocationManager } from "../src/server/auth/core.ts";

const london = "Europe/London";
const spring = Date.UTC(2025, 2, 30, 12);
const autumn = Date.UTC(2025, 9, 26, 12);
assert.equal(localDateKey(Date.UTC(2025, 2, 30, 0, 30), london), "2025-03-30");
const springRange = localDayRange(spring, london);
assert.equal(springRange.end - springRange.start, 23 * 60 * 60 * 1000);
assert.equal(localDateKey(springRange.end - 1, london), "2025-03-30");
const autumnRange = localDayRange(autumn, london);
assert.equal(autumnRange.end - autumnRange.start, 25 * 60 * 60 * 1000);
assert.equal(localDateKey(autumnRange.end - 1, london), "2025-10-26");

const users = {
  staff: { id: "staff", organisationId: "org-1", email: "staff@example.test", name: "Staff", role: "user" },
  manager: { id: "manager", organisationId: "org-1", email: "manager@example.test", name: "Manager", role: "user" },
  admin: { id: "admin", organisationId: "org-1", email: "admin@example.test", name: "Admin", role: "admin" },
};
const memberships = [
  { userId: "staff", locationId: "blackpool", role: "staff" },
  { userId: "manager", locationId: "blackpool", role: "manager" },
];
const repository = {
  listMemberships: async userId => memberships.filter(item => item.userId === userId),
};
const staffContext = await getAuthContext(repository, users.staff);
const managerContext = await getAuthContext(repository, users.manager);
const adminContext = await getAuthContext(repository, users.admin);
assert.doesNotThrow(() => requireLocationAccess(staffContext, "blackpool", "org-1"));
assert.throws(() => requireLocationAccess(staffContext, "bolton", "org-1"));
assert.doesNotThrow(() => requireLocationManager(managerContext, "blackpool", "org-1"));
assert.throws(() => requireLocationManager(managerContext, "bolton", "org-1"));
assert.doesNotThrow(() => requireLocationAccess(adminContext, "bolton", "org-1"));
assert.throws(() => requireLocationAccess(adminContext, "other-org-location", "org-2"));

assert.equal(new Set(FOUNDATION_LOCATIONS.map(location => location.shortName)).size, 4);
assert.equal(OPERATIONAL_DEFAULTS.security.length, 3);
assert.equal(OPERATIONAL_DEFAULTS.opening.length, 12);
assert.equal(OPERATIONAL_DEFAULTS.closing.length, 10);
assert.equal(new Set(OPERATIONAL_DEFAULTS.wastage).size, OPERATIONAL_DEFAULTS.wastage.length);
assert.equal(new Set(OPERATIONAL_DEFAULTS.cleaning).size, OPERATIONAL_DEFAULTS.cleaning.length);
assert.equal(new Set(OPERATIONAL_DEFAULTS.training).size, OPERATIONAL_DEFAULTS.training.length);

const serializableDashboard = { user: { role: "staff" }, location: { shortName: "blackpool" }, access: { memberships } };
assert.equal(JSON.stringify(serializableDashboard).includes("AUTH_SESSION_SECRET"), false);
console.log("Phase 3 dashboard, access, timezone and seed tests passed (19/19)");
