import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

const admin = await read("components/AdminSetup.tsx");
const overview = await read("components/admin/AdminStoreOverview.tsx");
const primitives = await read("components/admin/AdminPrimitives.tsx");

assert.match(admin, /AdminStoreOverview/);
assert.match(admin, /WastageCatalogueAdmin/);
assert.match(admin, /ComplianceReports/);
assert.match(admin, /useRestQuery<AdminOperation\[\]>/);
assert.match(admin, /function selectStore/);
assert.match(admin, /setCatalogueOpen\(false\)/);
assert.match(admin, /setReportsOpen\(false\)/);
assert.match(admin, /key=\{selectedLocationId\}/);
assert.doesNotMatch(admin, /@ts-nocheck/);
assert.doesNotMatch(admin, /eslint-disable/);

assert.match(overview, /restApi.admin.addChecklistQuestion/);
assert.match(overview, /restApi.admin.setFridgeCount/);
assert.match(overview, /restApi.admin.addSecurityQuestion/);
assert.match(overview, /restApi.admin.addTrainingRequirement/);
assert.match(overview, /documentsApi.upload/);
assert.match(overview, /onOpenCatalogue/);
assert.doesNotMatch(overview, /fetch\(/);

assert.match(primitives, /export function ListCard/);
assert.match(primitives, /export function QuestionList/);
assert.match(primitives, /export function FridgeEditor/);
assert.match(primitives, /export function TeamEditor/);

console.log("Admin decomposition tests passed: 20/20");
