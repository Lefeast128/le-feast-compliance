import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveCleaningMemberId } from "../src/lib/cleaning-attribution.ts";
import { cleaningRunsOn } from "../src/shared/cleaning-scheduling.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const storeAdmin = await read("src/components/admin/AdminStoreOverview.tsx");
const securityService = await read("src/server/management/security-service.ts");
const organisationAdmin = await read("src/components/OrganisationAdmin.tsx");
const cleaning = await read("src/components/InlineCleaning.tsx");
const dashboard = await read("src/pages/Dashboard.tsx");
const complianceCleaning = await read("src/server/compliance/cleaning-service.ts");

// Security configuration uses the existing soft-retirement path and keeps central ownership server-side.
assert.match(storeAdmin, /removeSecurityQuestion/);
assert.match(storeAdmin, /Historical answers and audit evidence will be preserved/);
assert.match(storeAdmin, /Managed in Organisation Admin/);
assert.match(securityService, /row\.centralItemId && context\.user\.role !== "admin"/);
assert.match(securityService, /active: false, deactivatedAt/);
assert.match(organisationAdmin, /Retire \$\{taskLabel\(item\.kind\)\}/);
assert.match(organisationAdmin, /retireCentralOperationalTask|retireOperational/);

// The cleaning UI must use the active person when no per-item override exists, without changing saved evidence.
assert.equal(resolveCleaningMemberId(undefined, "joe"), "joe");
assert.equal(resolveCleaningMemberId("sarah", "joe"), "sarah");
assert.equal(resolveCleaningMemberId("", "joe"), "joe");
assert.match(cleaning, /progress=\{\{ complete: completedCount, total: tasks\.length \}\}/);
assert.match(cleaning, /Complete/);
assert.match(cleaning, /Report issue/);
assert.match(cleaning, /resolveCleaningMemberId\(selected\[task\._id\], activeMemberId\)/);
assert.match(dashboard, /<InlineCleaning/);
assert.match(dashboard, /StructuredTaskWorkflow/);

// Scheduling remains server-authoritative and supports daily, weekly and multi-day work.
assert.equal(cleaningRunsOn("daily", [], 3), true);
assert.equal(cleaningRunsOn("weekly", [1, 3], 1), true);
assert.equal(cleaningRunsOn("weekly", [1, 3], 2), false);
assert.equal(cleaningRunsOn("specific_days", [0, 6], 6), true);
assert.match(complianceCleaning, /activeMember/);
assert.match(complianceCleaning, /onConflictDoNothing/);

console.log("Security deletion and cleaning checklist acceptance tests passed");
