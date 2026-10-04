import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");
const files = {
  facade: "src/server/management/service.ts",
  shared: "src/server/management/shared.ts",
  teamMembers: "src/server/management/team-members-service.ts",
  memberships: "src/server/management/memberships-service.ts",
  equipment: "src/server/management/equipment-service.ts",
  probe: "src/server/management/probe-service.ts",
  checklist: "src/server/management/checklist-service.ts",
  cleaning: "src/server/management/cleaning-service.ts",
  security: "src/server/management/security-service.ts",
  wastage: "src/server/management/wastage-service.ts",
  operations: "src/server/management/operations-service.ts",
};
const sources = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([key, file]) => [key, await read(file)])));
const domains = Object.values(sources).join("\n");
let passed = 0;
const check = (value, message) => { assert.ok(value, message); passed += 1; };

for (const name of [
  "listTeamMembers", "addTeamMember", "updateTeamMember", "deleteTeamMember",
  "addMembership", "removeMembership", "addEquipment", "updateEquipment", "setFridgeCount",
  "addProbe", "updateProbe", "deleteProbe", "addChecklist", "updateChecklist", "deleteChecklist", "reorderChecklist",
  "addCleaning", "updateCleaning", "deleteCleaning", "reorderCleaning", "addSecurity", "updateSecurity", "deleteSecurity",
  "addWastage", "updateWastage", "deleteWastage", "reorderWastage", "operations",
]) check(sources.facade.includes(name), `facade preserves ${name}`);

check(sources.facade.includes("./team-members-service.js"), "team member facade export");
check(sources.facade.includes("./memberships-service.js"), "membership facade export");
check(sources.facade.includes("./operations-service.js"), "operations facade export");
check(sources.shared.includes("requireLocationManager"), "manager authorization remains shared");
check(sources.shared.includes("requireUuid"), "shared identifier validation remains");
for (const key of ["equipment", "probe", "checklist", "cleaning", "wastage"]) check(sources[key].includes("db().transaction"), `${key} transactions preserved`);
for (const key of ["probe", "checklist", "cleaning", "security"]) check(sources[key].includes("versionRootId"), `${key} versioning preserved`);
check(sources.operations.includes("organisationId"), "operations organization scoping preserved");
check(!sources.facade.includes("getDb"), "facade has no database implementation");
check(!domains.includes("@ts-nocheck"), "no ts-nocheck added");
check(!domains.match(/:\s*any\b|<any>|\bas any\b/), "no explicit any in management services");
check(!domains.match(/from ["']\.\/service/), "management domains do not import facade");

console.log(`Management service decomposition tests passed: ${passed}/${passed}`);
