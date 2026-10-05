import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getRoleCapabilities, canManageLocation } from "../src/lib/role-capabilities.ts";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const dashboard = await read("src/pages/Dashboard.tsx");
const header = await read("src/components/dashboard/DashboardPrimitives.tsx");
const today = await read("src/components/dashboard/DashboardToday.tsx");
const admin = await read("src/components/AdminSetup.tsx");
const organisationAdmin = await read("src/components/OrganisationAdmin.tsx");
const userAccess = await read("src/components/UserAccessAdmin.tsx");
const operations = await read("src/server/management/operations-service.ts");
const accessService = await read("src/server/management/user-access-service.ts");
const auth = await read("src/server/auth/core.ts");

const staff = { id: "staff", organisationId: "org", email: "staff@example.test", name: "Staff", role: "user" };
const manager = { id: "manager", organisationId: "org", email: "manager@example.test", name: "Manager", role: "user" };
const adminUser = { id: "admin", organisationId: "org", email: "admin@example.test", name: "Admin", role: "admin" };
const staffMemberships = [{ userId: "staff", locationId: "blackpool", role: "staff" }];
const managerMemberships = [
  { userId: "manager", locationId: "bolton", role: "manager" },
  { userId: "manager", locationId: "blackpool", role: "staff" },
];

const checks = [
  () => assert.equal(getRoleCapabilities(staff, staffMemberships, "blackpool").canUseManagement, false),
  () => assert.equal(getRoleCapabilities(staff, staffMemberships, "blackpool").canViewManagerReviews, false),
  () => assert.equal(getRoleCapabilities(staff, staffMemberships, "blackpool").canManageUserAccess, false),
  () => assert.equal(canManageLocation(staff, staffMemberships, "blackpool"), false),
  () => assert.equal(canManageLocation(staff, staffMemberships, "bolton"), false),
  () => assert.equal(getRoleCapabilities(manager, managerMemberships, "bolton").canUseManagement, true),
  () => assert.equal(getRoleCapabilities(manager, managerMemberships, "bolton").canViewManagerReviews, true),
  () => assert.equal(getRoleCapabilities(manager, managerMemberships, "bolton").canManageUserAccess, false),
  () => assert.equal(canManageLocation(manager, managerMemberships, "blackpool"), false),
  () => assert.equal(canManageLocation(manager, managerMemberships, "bolton"), true),
  () => assert.equal(getRoleCapabilities(adminUser, [], "rochdale").canUseManagement, true),
  () => assert.equal(getRoleCapabilities(adminUser, [], "rochdale").canManageUserAccess, true),
  () => assert.equal(getRoleCapabilities(adminUser, [], "rochdale").canViewManagerReviews, true),
  () => assert.equal(canManageLocation(adminUser, [], "rochdale"), true),
  () => assert.match(header, /canUseManagement/),
  () => assert.match(header, /onCalendar/),
  () => assert.match(header, /onLogout/),
  () => assert.match(today, /canUseManagement &&/),
  () => assert.match(dashboard, /if \(view === "admin"\) return capabilities\.canUseManagement/),
  () => assert.match(dashboard, /if \(view === "managerReviews"\) return capabilities\.canViewManagerReviews/),
  () => assert.match(admin, /OrganisationAdmin/),
  () => assert.match(organisationAdmin, /UserAccessAdmin/),
  () => assert.match(operations, /memberships\.role, "manager"/),
  () => assert.match(auth, /requireLocationManager/),
  () => assert.match(accessService, /requireOrganisationAdmin/),
  () => assert.match(userAccess, /Access history/),
  () => assert.match(accessService, /user_access_invited|user_access_added|user_access_removed|user_access_role_changed/),
];

for (const check of checks) check();
console.log(`Role-based view tests passed: ${checks.length}/${checks.length}`);
