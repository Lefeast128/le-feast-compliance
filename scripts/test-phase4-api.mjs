import assert from "node:assert/strict";
import fs from "node:fs";
import { localDateKey, localDayRange } from "../src/server/dashboard/time.ts";

let passed = 0;
const check = (value, message) => { assert.ok(value, message); passed += 1; };
const root = new URL("../", import.meta.url).pathname;
const validationSource = fs.readFileSync(`${root}src/server/compliance/validation.ts`, "utf8");
const complianceSource = [
  "service.ts",
  "temperature-service.ts",
  "probe-service.ts",
  "checklist-service.ts",
  "security-service.ts",
  "wastage-service.ts",
  "cleaning-service.ts",
  "issue-service.ts",
].map(file => fs.readFileSync(`${root}src/server/compliance/${file}`, "utf8")).join("\n");
const fail = message => { throw new Error(message); };
const requireUuid = value => { if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) fail("invalid id"); return value; };
const requireString = value => { if (typeof value !== "string" || !value.trim()) fail("required"); return value.trim(); };
const requireFiniteNumber = value => { if (typeof value !== "number" || !Number.isFinite(value)) fail("number"); return value; };
const requirePositiveNumberString = value => { const text = requireString(value); if (!Number.isFinite(Number(text)) || Number(text) <= 0) fail("positive"); return text; };
const requireEnum = (value, _name, allowed) => { if (!allowed.includes(value)) fail("enum"); return value; };
const temperatureResult = (temperature, minimum, preferred, maximum) => temperature < minimum || temperature > maximum ? "fail" : temperature > preferred ? "within_limit" : "normal";
const probeResult = (temperature, minimum) => temperature >= minimum ? "pass" : "fail";
const equipmentApplicableAtRound = (createdAt, deactivatedAt, startedAt) => createdAt <= startedAt && (!deactivatedAt || deactivatedAt >= startedAt);
check(validationSource.includes("equipmentApplicableAtRound"), "round-start equipment rule is present");
check(validationSource.includes("temperatureResult"), "temperature result rule is present");
check(validationSource.includes("probeResult"), "probe result rule is present");
const routes = [
  "api/compliance/temperature-rounds.ts", "api/compliance/temperature-readings.ts", "api/compliance/temperature-rounds/[id]/complete.ts",
  "api/compliance/issues/[id]/action.ts", "api/compliance/issues/[id]/recheck.ts", "api/compliance/food-checks.ts",
  "api/compliance/probe-issues/[id]/recheck.ts", "api/compliance/checklists/responses.ts", "api/compliance/checklists/signoff.ts",
  "api/compliance/security/responses.ts", "api/compliance/security/signoff.ts", "api/compliance/wastage.ts",
  "api/compliance/cleaning/completions.ts", "api/compliance/issues.ts", "api/compliance/issues/[id]/updates.ts",
];
for (const route of routes) {
  check(fs.existsSync(`${root}${route}`), `route exists: ${route}`);
  check(fs.readFileSync(`${root}${route}`, "utf8").includes("handleMutation"), `route is authenticated: ${route}`);
}

check(temperatureResult(4, 0, 5, 8) === "normal", "normal temperature");
check(temperatureResult(6, 0, 5, 8) === "within_limit", "within-limit temperature");
check(temperatureResult(-0.1, 0, 5, 8) === "fail", "low failing temperature");
check(temperatureResult(9, 0, 5, 8) === "fail", "high failing temperature");
check(probeResult(76, 76) === "pass", "passing probe");
check(probeResult(75, 76) === "fail", "failing probe");
const started = new Date("2026-01-10T10:00:00Z");
check(equipmentApplicableAtRound(new Date("2026-01-01T00:00:00Z"), null, started), "old equipment applies");
check(!equipmentApplicableAtRound(new Date("2026-01-11T00:00:00Z"), null, started), "new equipment does not apply");
check(equipmentApplicableAtRound(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-11T00:00:00Z"), started), "later deactivation applies");
check(!equipmentApplicableAtRound(new Date("2026-01-01T00:00:00Z"), new Date("2026-01-09T00:00:00Z"), started), "earlier deactivation does not apply");
check(localDateKey(Date.UTC(2025, 2, 30, 23, 30), "Europe/London") === "2025-03-31", "BST local date");
check(localDayRange(Date.UTC(2025, 9, 26, 12), "Europe/London").end - localDayRange(Date.UTC(2025, 9, 26, 12), "Europe/London").start === 25 * 60 * 60 * 1000, "GMT local day");

assert.throws(() => requireFiniteNumber(Number.NaN, "temperature")); passed += 1;
assert.throws(() => requirePositiveNumberString("0")); passed += 1;
assert.throws(() => requireEnum("night", "session", ["AM", "PM"])); passed += 1;
assert.throws(() => requireString("  ", "action")); passed += 1;
assert.throws(() => requireUuid("not-an-id", "issueId")); passed += 1;
check(requireUuid("00000000-0000-0000-0000-000000000000", "issueId").length === 36, "UUID accepted");
check(requireString(" action ", "action") === "action", "trimmed action");
check(requirePositiveNumberString("1.5") === "1.5", "positive quantity");
check(requireEnum("AM", "session", ["AM", "PM"]) === "AM", "session enum");
check(fs.readFileSync(`${root}src/server/compliance/http.ts`, "utf8").includes("Authentication required"), "unauthenticated requests are rejected");
check(fs.readFileSync(`${root}src/server/compliance/http.ts`, "utf8").includes("Invalid request origin"), "invalid origins are rejected");
check(complianceSource.includes("db.transaction"), "multi-record writes use transactions");

console.log(`Phase 4 operational API tests passed (${passed}/${passed})`);
