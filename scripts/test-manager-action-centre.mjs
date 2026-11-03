import assert from "node:assert/strict";
import { buildManagerActionCentre, countManagerAttention } from "../src/lib/manager-action-centre.ts";
import { buildDailyTaskModels } from "../src/components/dashboard/daily-checks-model.ts";
import { localOperationalDate } from "../src/lib/manager-action-scheduling.ts";

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
assert.equal(centre.required.find(item => item.id === "am")?.status, "in_progress", "a completed round with an unresolved linked failure remains flagged for follow-up");
assert.match(centre.required.find(item => item.id === "am")?.detail ?? "", /Issue reported/);
assert.equal(centre.required.find(item => item.id === "pm")?.status, "pending_today");
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
  cleaningCompletions: [{ taskId: "clean-1", completedAt: timestamp }],
  additionalRequirements: [
    { _id: "additional-due", nextDueAt: "2026-10-08T09:00:00.000Z" },
    { _id: "additional-complete", nextDueAt: "2026-10-08T10:00:00.000Z", versionRootId: "additional-root" },
  ],
  additionalCompletions: [{ requirementRootId: "additional-root", scheduledDueAt: "2026-10-08T10:00:00.000Z" }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 2, complete: 1, incomplete: 1, incompleteTaskIds: ["clean-2"], issueReported: 0, afterUse: 0, afterUseComplete: 0 });
assert.deepEqual(centre.additional, { due: 2, complete: 1, incomplete: 1, overdue: 1, issueReported: 0 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [{ _id: "clean-1", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [] }],
  cleaningCompletions: [{ taskId: "clean-1", completedAt: timestamp }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 1, complete: 1, incomplete: 0, incompleteTaskIds: [], issueReported: 0, afterUse: 0, afterUseComplete: 0 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [
    { _id: "clean-daily", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [], frequency: "daily" },
    { _id: "clean-after-use", area: "cleaning", title: "Clean slicer after use", taskType: "simple", completionMode: "task", steps: [], frequency: "after_use" },
  ],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 1, complete: 0, incomplete: 1, incompleteTaskIds: ["clean-daily"], issueReported: 0, afterUse: 1, afterUseComplete: 0 });

centre = buildManagerActionCentre({
  ...base,
  structuredTasks: [{ _id: "clean-after-use", area: "cleaning", title: "Clean slicer after use", taskType: "simple", completionMode: "task", steps: [], frequency: "after_use" }],
  cleaningCompletions: [{ taskId: "clean-after-use", completedAt: timestamp }],
}, timestamp);
assert.deepEqual(centre.cleaning, { due: 0, complete: 0, incomplete: 0, incompleteTaskIds: [], issueReported: 0, afterUse: 1, afterUseComplete: 1 });
const noAfterUseCentre = buildManagerActionCentre({ ...base, structuredTasks: [] }, timestamp);
assert.equal(countManagerAttention(0, 0, centre), countManagerAttention(0, 0, noAfterUseCentre), "after-use checks do not count until triggered");

const sameDayAdditional = buildManagerActionCentre({
  ...base,
  additionalRequirements: [{ _id: "additional-today", nextDueAt: "2026-10-09T09:00:00.000Z" }],
}, timestamp);
assert.deepEqual(sameDayAdditional.additional, { due: 1, complete: 0, incomplete: 1, overdue: 0, issueReported: 0 }, "same-day additional work is due now, not overdue without a deadline");
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

for (const time of [
  "2026-10-09T08:00:00.000Z",
  "2026-10-09T15:00:00.000Z",
  "2026-10-09T21:00:00.000Z",
]) {
  const pending = buildManagerActionCentre(base, Date.parse(time));
  assert.equal(pending.required.find(item => item.id === "am")?.status, "in_progress", "unresolved linked issue remains visible at every time of day");
  assert.equal(pending.required.find(item => item.id === "pm")?.status, "pending_today", `PM remains neutral at ${time} without configured timing`);
  assert.equal(pending.required.find(item => item.id === "closing")?.status, "pending_today");
  assert.equal(pending.required.some(item => item.status === "overdue"), false);
}

const completedEvening = buildManagerActionCentre({
  ...base,
  rounds: [...base.rounds, { _id: "pm-round", session: "PM", completedAt: timestamp }],
  checklists: { ...base.checklists, closing: { questions: [], responses: [{}] } },
  securityResponses: { ...base.securityResponses, PM: [{}] },
  checklistSignOffs: [{ checklist: "closing" }],
  securitySignOffs: [{ session: "PM" }],
}, Date.parse("2026-10-09T21:00:00.000Z"));
assert.equal(completedEvening.required.find(item => item.id === "pm")?.status, "complete");
assert.equal(completedEvening.required.find(item => item.id === "closing")?.status, "complete");
assert.equal(completedEvening.required.find(item => item.id === "security_pm")?.status, "complete");

const newYorkMorning = buildManagerActionCentre({
  ...base,
  location: { ...base.location, timezone: "America/New_York" },
  additionalRequirements: [{ _id: "additional-local-day", nextDueAt: "2026-10-09T09:00:00-04:00" }],
}, Date.parse("2026-10-10T01:00:00.000Z"));
assert.equal(newYorkMorning.additional.overdue, 0, "store timezone controls the additional-check day boundary");
const newYorkNextDay = buildManagerActionCentre({
  ...base,
  location: { ...base.location, timezone: "America/New_York" },
  additionalRequirements: [{ _id: "additional-local-day", nextDueAt: "2026-10-09T09:00:00-04:00" }],
}, Date.parse("2026-10-10T05:00:00.000Z"));
assert.equal(newYorkNextDay.additional.overdue, 1, "additional check becomes overdue only on the next local day");

const scheduledCleaning = buildManagerActionCentre({
  ...base,
  structuredTasks: [
    { _id: "daily", area: "cleaning", title: "Daily", taskType: "simple", completionMode: "task", steps: [], frequency: "daily" },
    { _id: "weekly-monday", area: "cleaning", title: "Monday", taskType: "simple", completionMode: "task", steps: [], frequency: "weekly", weekdays: [1] },
    { _id: "specific-friday", area: "cleaning", title: "Friday", taskType: "simple", completionMode: "task", steps: [], frequency: "specific_days", weekdays: [5] },
    { _id: "multiple", area: "cleaning", title: "Fri/Sat", taskType: "simple", completionMode: "task", steps: [], frequency: "specific_days", weekdays: [5, 6] },
    { _id: "after-use", area: "cleaning", title: "After use", taskType: "simple", completionMode: "task", steps: [], frequency: "after_use" },
  ],
  cleaningCompletions: [{ taskId: "daily", completedAt: timestamp }],
}, timestamp);
assert.deepEqual(scheduledCleaning.cleaning, { due: 3, complete: 1, incomplete: 2, incompleteTaskIds: ["specific-friday", "multiple"], issueReported: 0, afterUse: 1, afterUseComplete: 0 }, "daily and Friday tasks count, unscheduled weekly task does not");
const dailyScheduledCleaning = buildDailyTaskModels({ equipmentCount: 1, amComplete: true, pmComplete: true, amInProgress: false, pmInProgress: false, openingComplete: true, closingComplete: true, amSecurityComplete: true, pmSecurityComplete: true, foodProbeCount: 1, cleaningCompleted: scheduledCleaning.cleaning.complete, cleaningDue: scheduledCleaning.cleaning.due, additionalCompleted: 0, additionalDue: 0, wastageCount: 1, issueAttentionTaskIds: [] }).find(task => task.id === "cleaning");
assert.equal(dailyScheduledCleaning?.detail, "1 of 3 due today complete", "Daily Checks and Manager Action Centre share the scheduled cleaning denominator");

const linkedCleaningIssue = buildManagerActionCentre({
  ...base,
  issues: [{ _id: "cleaning-issue", status: "open", category: "Operational task", title: "Clean surfaces: missed area", description: "Reported" }],
  structuredTasks: [
    { _id: "clean-linked", area: "cleaning", title: "Clean surfaces", taskType: "simple", completionMode: "task", steps: [], frequency: "daily" },
    { _id: "clean-unrelated", area: "cleaning", title: "Clean prep table", taskType: "simple", completionMode: "task", steps: [], frequency: "daily" },
  ],
}, timestamp);
assert.ok(linkedCleaningIssue.issueLinkedTaskIds.includes("cleaning:clean-linked"));
assert.ok(linkedCleaningIssue.issueLinkedTaskIds.includes("cleaning"), "daily card remains marked for attention");
assert.equal(linkedCleaningIssue.cleaning.issueReported, 1);
assert.equal(countManagerAttention(linkedCleaningIssue.unresolvedIssues, 0, linkedCleaningIssue), 1 + 1 + linkedCleaningIssue.required.filter(item => item.requiresAttention).length, "issue is counted once and unrelated incomplete cleaning remains actionable");

const numericDueToday = buildManagerActionCentre({
  ...base,
  additionalRequirements: [{ _id: "additional-numeric", nextDueAt: "2026-10-09T23:00:00+01:00" }],
}, timestamp);
assert.equal(numericDueToday.additional.due, 1, "additional check scheduled later on the store-local date is visible as due today");
assert.equal(numericDueToday.additional.overdue, 0);
assert.equal(localOperationalDate(Date.parse("2026-10-24T23:30:00Z"), "Europe/London"), "2026-10-25", "store date follows BST transition rather than browser/UTC date");

const additionalWithIssue = buildManagerActionCentre({
  ...base,
  additionalRequirements: [{ _id: "additional-issued", versionRootId: "add-root", nextDueAt: "2026-10-08T09:00:00.000Z" }],
  additionalCompletions: [{ requirementRootId: "add-root", scheduledDueAt: "2026-10-08T09:00:00.000Z" }],
  issues: [{ _id: "additional-issue", status: "monitoring", title: "Additional failure", description: "Reported", sourceAdditionalCompletionId: "completion-1" }],
}, timestamp);
assert.equal(additionalWithIssue.additional.complete, 1);
assert.equal(additionalWithIssue.additional.issueReported, 1, "failed additional completion remains visible as an issue, not a clean pass");
assert.equal(countManagerAttention(1, 0, additionalWithIssue), 1 + additionalWithIssue.required.filter(item => item.requiresAttention).length, "linked additional issue is counted once");

console.log("Manager action centre tests passed: due states, issue follow-up, cleaning/additional counts and resolved evidence");
