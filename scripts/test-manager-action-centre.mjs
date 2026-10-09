import assert from "node:assert/strict";
import { buildManagerActionCentre } from "../src/lib/manager-action-centre.ts";

const timestamp = Date.parse("2026-10-09T12:00:00.000Z");
const base = {
  rounds: [{ _id: "am-round", session: "AM", completedAt: timestamp }],
  equipment: [],
  readings: [
    { _id: "failed-reading", roundId: "am-round", result: "fail", temperature: 9.2 },
    { _id: "resolved-reading", roundId: "am-round", result: "fail", temperature: 8.8 },
  ],
  issues: [
    { _id: "open-temperature", status: "open", title: "Temperature issue", description: "Too high", sourceTemperatureReadingId: "failed-reading" },
    { _id: "resolved-temperature", status: "resolved", title: "Resolved temperature issue", description: "Closed", sourceTemperatureReadingId: "resolved-reading" },
  ],
  checklists: { opening: { questions: [], responses: [] }, closing: { questions: [], responses: [] } },
  security: { AM: [], PM: [] },
  securityResponses: { AM: [], PM: [] },
  checklistSignOffs: [],
  securitySignOffs: [],
  structuredTasks: [],
  structuredTaskResponses: [],
  cleaningTasks: [],
  cleaningCompletions: [],
  additionalRequirements: [],
  additionalCompletions: [],
};

let centre = buildManagerActionCentre(base, timestamp);
assert.equal(centre.required.find(item => item.id === "am")?.status, "complete");
assert.equal(centre.required.find(item => item.id === "pm")?.status, "incomplete");
assert.equal(centre.failedTemperatures, 1, "only unresolved failed readings require follow-up");
assert.equal(centre.unresolvedIssues, 1);
assert.equal(centre.cleaning.due, 0);
assert.equal(centre.additional.due, 0);

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [
    { _id: "clean-1", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [] },
    { _id: "clean-2", area: "cleaning", title: "Clean fridge", taskType: "simple", completionMode: "task", steps: [] },
  ],
  cleaningCompletions: [{ taskId: "clean-1" }],
  additionalRequirements: [
    { _id: "additional-due", nextDueAt: "2026-10-08T09:00:00.000Z" },
    { _id: "additional-complete", nextDueAt: "2026-10-08T10:00:00.000Z", versionRootId: "additional-root" },
  ],
  additionalCompletions: [{ requirementRootId: "additional-root", scheduledDueAt: "2026-10-08T10:00:00.000Z" }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 2, complete: 1, incomplete: 1 });
assert.deepEqual(centre.additional, { due: 2, complete: 1, incomplete: 1, overdue: 1 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [{ _id: "clean-1", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [] }],
  cleaningCompletions: [{ taskId: "clean-1" }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 1, complete: 1, incomplete: 0 });

console.log("Manager action centre tests passed: due states, issue follow-up, cleaning/additional counts and resolved evidence");
