import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildDailyTaskModels, getProgressPercent } from "../src/components/dashboard/daily-checks-model.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const probe = await read("src/components/dashboard/DashboardWorkflowScreens.tsx");
const additional = await read("src/components/AdditionalChecksView.tsx");
const training = await read("src/components/TrainingView.tsx");
const structured = await read("src/components/StructuredTaskWorkflow.tsx");
const checklist = await read("src/components/InlineChecklist.tsx");
const temperature = await read("src/components/TemperatureActionScreen.tsx");
const attribution = await read("src/components/dashboard/StaffAttribution.tsx");
const workflow = await read("src/components/dashboard/useDashboardWorkflows.ts");

const base = {
  equipmentCount: 4,
  amComplete: false,
  pmComplete: false,
  amInProgress: false,
  pmInProgress: false,
  openingComplete: false,
  closingComplete: false,
  amSecurityComplete: false,
  pmSecurityComplete: false,
  foodProbeCount: 0,
  cleaningCompleted: 0,
  cleaningDue: 0,
  additionalCompleted: 0,
  additionalDue: 0,
  wastageCount: 0,
  issueAttentionTaskIds: [],
};

const tasks = buildDailyTaskModels(base);
assert.equal(tasks.filter((task) => task.required).length, 6, "required progress remains six checks");
assert.equal(getProgressPercent(6, 6), 100, "required progress still reaches 100 percent");
assert.equal(tasks.find((task) => task.id === "cleaning")?.detail, "Nothing due today");
assert.equal(tasks.find((task) => task.id === "additional-checks")?.detail, "Nothing due today");

assert.match(probe, /Record probe/);
assert.match(probe, /Record recheck/);
assert.match(probe, /Saving…/);
assert.match(probe, /role="alert"/);
assert.match(additional, /Complete check/);
assert.match(additional, /saving \|\|/);
assert.match(additional, /This check could not be saved/);
assert.match(training, /Complete Acknowledgement/);
assert.match(training, /acknowledgementSaving/);
assert.match(training, /acknowledgementError/);
assert.match(structured, /Save response/);
assert.match(structured, /Checklist complete/);
assert.match(checklist, /Task completed/);
assert.match(checklist, /Answer recorded/);
assert.match(temperature, /Corrective action recorded/);
assert.match(attribution, /Signed by:/);
assert.match(attribution, /Change/);
assert.match(workflow, /toast\.success\("Corrective action recorded"/);

console.log("Staff experience Phase 1 tests passed");
