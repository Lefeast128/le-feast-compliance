import assert from "node:assert/strict";
import { buildManagerActionCentre, countManagerAttention } from "../src/lib/manager-action-centre.ts";

const timestamp = Date.parse("2026-10-09T12:00:00.000Z");
const base = {
  location: { _id: "store-1", name: "Blackpool North", timezone: "Europe/London" },
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
assert.equal(centre.required.find(item => item.id === "pm")?.status, "due_later");
assert.equal(centre.required.find(item => item.id === "pm")?.requiresAttention, false);
assert.equal(centre.required.find(item => item.id === "opening")?.status, "due_now");
assert.equal(centre.failedTemperatures, 1, "only unresolved failed readings require follow-up");
assert.equal(centre.unresolvedIssues, 1);
assert.equal(centre.cleaning.due, 0);
assert.equal(centre.additional.due, 0);
assert.deepEqual(centre.issueLinkedTaskIds, ["am-temperature"]);
const noIssueCentre = buildManagerActionCentre({ ...base, issues: [] }, timestamp);
assert.equal(countManagerAttention(centre.unresolvedIssues, 0, centre), countManagerAttention(0, 0, noIssueCentre) + 1, "an unresolved issue is counted once, not again as a required task");

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
assert.deepEqual(centre.cleaning, { due: 2, complete: 1, incomplete: 1, afterUse: 0, afterUseComplete: 0 });
assert.deepEqual(centre.additional, { due: 2, complete: 1, incomplete: 1, overdue: 1 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [{ _id: "clean-1", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [] }],
  cleaningCompletions: [{ taskId: "clean-1" }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 1, complete: 1, incomplete: 0, afterUse: 0, afterUseComplete: 0 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [
    { _id: "clean-daily", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [], frequency: "daily" },
    { _id: "clean-after-use", area: "cleaning", title: "Clean slicer after use", taskType: "simple", completionMode: "task", steps: [], frequency: "after_use" },
  ],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 1, complete: 0, incomplete: 1, afterUse: 1, afterUseComplete: 0 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [{ _id: "clean-after-use", area: "cleaning", title: "Clean slicer after use", taskType: "simple", completionMode: "task", steps: [], frequency: "after_use" }],
  cleaningCompletions: [{ taskId: "clean-after-use" }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 0, complete: 0, incomplete: 0, afterUse: 1, afterUseComplete: 1 });
const noAfterUseCentre = buildManagerActionCentre({ ...base, structuredTasks: [] }, timestamp);
assert.equal(countManagerAttention(0, 0, centre), countManagerAttention(0, 0, noAfterUseCentre), "after-use checks do not count until triggered");

const sameDayAdditional = buildManagerActionCentre({
  ...base,
  additionalRequirements: [{ _id: "additional-today", nextDueAt: "2026-10-09T09:00:00.000Z" }],
}, timestamp);
assert.deepEqual(sameDayAdditional.additional, { due: 1, complete: 0, incomplete: 1, overdue: 0 }, "same-day additional work is due now, not overdue without a deadline");
assert.equal(countManagerAttention(0, 0, sameDayAdditional), countManagerAttention(0, 0, noAfterUseCentre) + 1, "a due additional check counts as one action");

const inProgress = buildManagerActionCentre({
  ...base,
  rounds: [{ _id: "am-round", session: "AM", completedAt: timestamp }, { _id: "pm-round", session: "PM", completedAt: null }],
  structuredTasks: [{ _id: "opening-1", area: "opening", title: "Opening task", taskType: "simple", completionMode: "task", steps: [] }],
  structuredTaskResponses: [{ _id: "response-1", taskArea: "opening", taskId: "opening-1", stepId: "simple", responseType: "confirm", responseValue: "confirmed", dateKey: "2026-10-09" }],
}, timestamp);
assert.equal(inProgress.required.find(item => item.id === "pm")?.status, "in_progress");
assert.equal(inProgress.required.find(item => item.id === "opening")?.status, "in_progress");
assert.equal(inProgress.required.find(item => item.id === "pm")?.requiresAttention, true);

console.log("Manager action centre tests passed: due states, issue follow-up, cleaning/additional counts and resolved evidence");
