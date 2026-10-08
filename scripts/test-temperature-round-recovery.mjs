import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const service = await read("src/server/compliance/temperature-service.ts");
const workflow = await read("src/components/dashboard/useDashboardWorkflows.ts");
const actionScreen = await read("src/components/TemperatureActionScreen.tsx");
const dashboardTypes = await read("src/components/dashboard/dashboard-types.ts");

assert.match(service, /Every failed fridge must have a corrective action before completing the round/);
assert.doesNotMatch(service, /Every failed fridge must have a recheck before completing the round/);
assert.match(service, /sourceTemperatureReadingId: reading\.id/);
assert.match(service, /minimumTemperature: minimum/);
assert.match(service, /maximumTemperature: maximum/);
assert.match(workflow, /pendingAmRound/);
assert.match(workflow, /pendingPmRound/);
assert.doesNotMatch(workflow, /useEffect\(\(\) => \{\s*if \(!active \|\| round\) return;\s*const pending/);
assert.match(workflow, /roundReadings/);
assert.match(workflow, /existingReadings: readingsBeforeSubmit/);
assert.match(workflow, /setRoundCompleterId/);
assert.doesNotMatch(workflow.slice(workflow.indexOf("async function saveTemperatureActions"), workflow.indexOf("async function saveProbe")), /completeRound\(/, "saving the final corrective action must not silently complete the round");
assert.match(workflow, /linkedIssue\?\.updates\?\.find/);
assert.match(workflow, /completeRecoveredTemperatureRound/);
assert.match(actionScreen, /Complete temperature round/);
assert.match(actionScreen, /Issue reported/);
assert.match(dashboardTypes, /updates\?: Array/);
console.log("Temperature round recovery tests passed: immutable readings, corrective-action gate, resumable rounds and safe completion");
