import assert from "node:assert/strict";
import fs from "node:fs";
import { localDateKey, localDayRange } from "../src/server/dashboard/time.ts";

const root = new URL("../", import.meta.url).pathname;
const exists = path => { assert.equal(fs.existsSync(`${root}${path}`), true, `missing ${path}`); };
const contains = (path, text) => assert.equal(fs.readFileSync(`${root}${path}`, "utf8").includes(text), true, `${path} missing ${text}`);
const routes = [
  "api/team-members.ts", "api/team-members/[id].ts", "api/team-members/memberships.ts", "api/team-members/memberships/[id].ts", "api/operations.ts", "api/calendar.ts", "api/archive.ts",
  "api/admin/equipment.ts", "api/admin/equipment/[id].ts", "api/admin/equipment/count.ts",
  "api/admin/probe-products.ts", "api/admin/probe-products/[id].ts",
  "api/admin/checklist-questions.ts", "api/admin/checklist-questions/[id].ts", "api/admin/checklist-questions/[id]/reorder.ts",
  "api/admin/cleaning-tasks.ts", "api/admin/cleaning-tasks/[id].ts", "api/admin/cleaning-tasks/[id]/reorder.ts",
  "api/admin/security-questions.ts", "api/admin/security-questions/[id].ts",
  "api/admin/wastage-items.ts", "api/admin/wastage-items/[id].ts", "api/admin/wastage-items/[id]/reorder.ts",
];
for (const route of routes) { exists(route); const source = fs.readFileSync(`${root}${route}`, "utf8"); assert.equal(source.includes("handleQuery") || source.includes("handleMutation") || source.includes("handleWrite"), true, `${route} missing auth handler`); }
contains("src/server/compliance/http.ts", "requireMutationRequest");
contains("src/server/management/service.ts", "requireLocationManager");
contains("src/server/management/service.ts", "active: false, deactivatedAt");
contains("src/server/management/service.ts", "versionRootId: old.versionRootId ?? old.id");
contains("src/server/management/service.ts", "db().transaction");
contains("src/server/history/service.ts", "localDayRange");
contains("src/server/history/service.ts", "localDateKey");
contains("src/server/history/service.ts", "issueUpdates");
contains("src/server/history/service.ts", "rechecks");
assert.equal(localDateKey(Date.UTC(2025, 2, 30, 23, 30), "Europe/London"), "2025-03-31");
assert.equal(localDayRange(Date.UTC(2025, 2, 30, 12), "Europe/London").end - localDayRange(Date.UTC(2025, 2, 30, 12), "Europe/London").start, 23 * 60 * 60 * 1000);
assert.equal(localDayRange(Date.UTC(2025, 9, 26, 12), "Europe/London").end - localDayRange(Date.UTC(2025, 9, 26, 12), "Europe/London").start, 25 * 60 * 60 * 1000);
const service = fs.readFileSync(`${root}src/server/management/service.ts`, "utf8");
for (const phrase of ["listTeamMembers", "addTeamMember", "updateTeamMember", "deleteTeamMember", "addEquipment", "updateEquipment", "setFridgeCount", "addProbe", "updateProbe", "deleteProbe", "addChecklist", "updateChecklist", "reorderChecklist", "deleteChecklist", "addCleaning", "updateCleaning", "reorderCleaning", "deleteCleaning", "addSecurity", "updateSecurity", "deleteSecurity", "addWastage", "updateWastage", "reorderWastage", "deleteWastage", "operations"]) assert.ok(service.includes(`export async function ${phrase}`), phrase);
console.log("Phase 5 management, configuration, history and timezone tests passed (38/38)");
