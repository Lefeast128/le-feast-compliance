import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../src/server/compliance/", import.meta.url);
const read = (name) => readFile(new URL(name, root), "utf8");

const service = await read("service.ts");
const shared = await read("shared.ts");
const domains = {
  temperature: await read("temperature-service.ts"),
  probe: await read("probe-service.ts"),
  checklist: await read("checklist-service.ts"),
  security: await read("security-service.ts"),
  wastage: await read("wastage-service.ts"),
  cleaning: await read("cleaning-service.ts"),
  issue: await read("issue-service.ts"),
};

for (const name of [
  "startRound",
  "recordTemperature",
  "completeRound",
  "addTemperatureRecheck",
  "recordFoodCheck",
  "addProbeRecheck",
  "saveChecklistResponse",
  "signOffChecklist",
  "saveSecurityResponse",
  "signOffSecurity",
  "recordWastage",
  "completeCleaning",
  "addIssueAction",
  "createManualIssue",
  "addIssueUpdate",
]) {
  assert.match(service, new RegExp(`export \\{[\\s\\S]*\\b${name}\\b`));
}

assert.match(shared, /export async function locationFor/);
assert.match(shared, /export async function activeMember/);
assert.match(shared, /export async function issueAndMember/);
assert.match(domains.temperature, /db\.transaction/);
assert.match(domains.probe, /db\.transaction/);
assert.match(domains.checklist, /db\.transaction/);
assert.match(domains.security, /db\.transaction/);
assert.match(domains.wastage, /db\.transaction/);
assert.match(domains.issue, /db\.transaction/);
assert.doesNotMatch(service, /getDb|db\.transaction|@ts-nocheck/);
for (const source of Object.values(domains)) {
  assert.doesNotMatch(source, /from ["']\.\/service/);
  assert.doesNotMatch(source, /\bany\b/);
}

console.log("Compliance service decomposition tests passed: 26/26");
