import assert from "node:assert/strict";
import { buildManagerOverviewActions } from "../src/lib/manager-overview.ts";

const now = Date.parse("2026-11-03T12:00:00.000Z");
const centre = {
  required: [
    { id: "am", taskId: "am-temperature", label: "AM temperatures", status: "due_now", detail: "Fridge round", requiresAttention: true },
    { id: "pm", taskId: "pm-temperature", label: "PM temperatures", status: "pending_today", detail: "Evening round", requiresAttention: false },
    { id: "opening", taskId: "opening-checklist", label: "Opening checklist", status: "in_progress", detail: "Issue reported — follow-up required", requiresAttention: true },
  ],
  failedTemperatures: 1, unresolvedIssues: 2,
  cleaning: { due: 2, complete: 0, incomplete: 2, incompleteTaskIds: ["cleaning-a", "cleaning-b"], issueReported: 1, afterUse: 0, afterUseComplete: 0 },
  additional: { due: 2, complete: 0, incomplete: 2, overdue: 1, issueReported: 1 },
  issueLinkedTaskIds: ["opening-checklist", "cleaning:cleaning-a"],
};
const result = buildManagerOverviewActions({
  now, timezone: "Europe/London", centre,
  issues: [
    { id: "issue-routine", title: "Door closer needs adjustment", status: "open", category: "Maintenance", createdByName: "Alex" },
    { id: "issue-failure", title: "Fridge temperature out of range", status: "monitoring", category: "Temperature", originalReading: "9.2°C", latestAction: "Moved food to safe storage", teamMemberName: "Sam" },
    { id: "issue-resolved", title: "Resolved issue", status: "resolved" },
  ],
  cleaningTasks: [{ _id: "cleaning-a", title: "Issue-linked clean" }, { _id: "cleaning-b", title: "Floors" }],
  additionalRequirements: [
    { _id: "add-overdue", title: "Probe calibration", nextDueAt: "2026-11-02T12:00:00.000Z" },
    { _id: "add-today", title: "Supplier temperature log", nextDueAt: "2026-11-03T10:00:00.000Z" },
    { _id: "add-later", title: "Monthly review", nextDueAt: "2026-11-04T10:00:00.000Z" },
  ],
  additionalCompletions: [{ requirementId: "add-today", scheduledDueAt: "2026-11-03T10:00:00.000Z" }],
  weekly: { status: "overdue", start: "2026-10-26", end: "2026-11-01" },
  fourWeekly: { status: "up_to_date" },
});
assert.deepEqual(result.actions.map(item => item.id), [
  "issue:issue-failure", "issue:issue-routine", "additional:add-overdue",
  "required:am", "cleaning:cleaning-b", "review:weekly",
]);
assert.deepEqual(result.actions.find(item => item.id === "required:am")?.target, { kind: "required", taskId: "am" });
assert.deepEqual(result.actions.find(item => item.id === "cleaning:cleaning-b")?.target, { kind: "cleaning", taskId: "cleaning-b" });
assert.deepEqual(result.actions.find(item => item.id === "additional:add-overdue")?.target, { kind: "additional", requirementId: "add-overdue" });
assert.deepEqual(result.actions.find(item => item.id === "review:weekly")?.target, { kind: "review", reviewType: "weekly" });
assert.equal(result.actions.find(item => item.id === "issue:issue-failure")?.issueId, "issue-failure");
assert.equal(result.actions.find(item => item.id === "additional:add-overdue")?.status, "overdue");
assert.deepEqual(result.dueLater.map(item => item.id), ["pm"]);
assert.deepEqual(result.summary, { checksOutstanding: 1, unresolvedIssues: 2, cleaningOutstanding: 1, reviewsDue: 1 });
assert.equal(result.actions.some(item => item.id === "issue:issue-resolved"), false);
console.log("Manager Overview action model tests passed");
