import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleaningProgress, isCleaningTaskComplete } from "../src/lib/cleaning-checklist.ts";
import { resolveCleaningMemberId } from "../src/lib/cleaning-attribution.ts";

const tasks = [
  { _id: "simple", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task" },
  { _id: "question", area: "cleaning", title: "Fridges operating correctly?", taskType: "simple", completionMode: "question" },
  {
    _id: "steps",
    area: "cleaning",
    title: "Complete close-down cleaning",
    taskType: "with_steps",
    completionMode: "question",
    steps: [
      { id: "surfaces", label: "Sanitise surfaces", responseType: "confirm", required: true },
      { id: "floors", label: "Clean floors", responseType: "confirm", required: true },
      { id: "optional", label: "Clean windows", responseType: "confirm", required: false },
    ],
  },
];

const legacySimple = [{ taskId: "simple" }];
const questionResponse = {
  _id: "question-response",
  taskArea: "cleaning",
  taskId: "question",
  stepId: "simple",
  responseType: "yes_no",
  responseValue: "yes",
  dateKey: "2026-10-09",
  createdAt: "2026-10-09T08:30:00.000Z",
  teamMemberId: "sarah",
};
const firstStepResponse = {
  _id: "step-response-1",
  taskArea: "cleaning",
  taskId: "steps",
  stepId: "surfaces",
  responseType: "confirm",
  responseValue: "confirmed",
  dateKey: "2026-10-09",
  createdAt: "2026-10-09T08:31:00.000Z",
  teamMemberId: "joe",
};
const secondStepResponse = {
  ...firstStepResponse,
  _id: "step-response-2",
  stepId: "floors",
  createdAt: "2026-10-09T08:32:00.000Z",
  teamMemberId: "sarah",
};

assert.equal(isCleaningTaskComplete(tasks[0], [], legacySimple), true, "legacy simple task remains complete");
assert.equal(isCleaningTaskComplete(tasks[1], [questionResponse], []), true, "Yes/No question completion is recognised");
assert.equal(isCleaningTaskComplete(tasks[2], [firstStepResponse], []), false, "required step keeps detailed task incomplete");
assert.equal(isCleaningTaskComplete(tasks[2], [firstStepResponse, secondStepResponse], []), true, "all required steps complete the detailed task");
assert.deepEqual(cleaningProgress(tasks, [questionResponse, firstStepResponse], legacySimple), { complete: 2, total: 3 });
assert.deepEqual(cleaningProgress(tasks, [questionResponse, firstStepResponse, secondStepResponse], legacySimple), { complete: 3, total: 3 });

assert.equal(resolveCleaningMemberId(undefined, "joe"), "joe", "active staff is the default attribution");
assert.equal(resolveCleaningMemberId("sarah", "joe"), "sarah", "per-item override remains authoritative");

const wrapper = await readFile("src/components/InlineCleaning.tsx", "utf8");
const workflow = await readFile("src/components/StructuredTaskWorkflow.tsx", "utf8");
const dashboard = await readFile("src/pages/Dashboard.tsx", "utf8");
assert.match(wrapper, /<StructuredTaskWorkflow/);
assert.match(workflow, /usesLegacyCleaningCompletion/);
assert.match(workflow, /step\.responseType === "yes_no"/);
assert.match(workflow, /onReportCleaningIssue/);
assert.match(dashboard, /structuredTasks \?\? \[\]\)\.filter\(\(task\) => task\.area === "cleaning"\)/);

console.log("Cleaning unified mixed-task behaviour tests passed");
