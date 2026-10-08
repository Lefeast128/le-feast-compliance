import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildDailyTaskModels,
  dailyTaskStatusLabel,
  getIssueAttentionTaskIds,
  getProgressMessage,
  getProgressPercent,
  getTaskStatus,
} from "../src/components/dashboard/daily-checks-model.ts";

const journeySource = await readFile(new URL("../src/components/dashboard/DailyChecksJourney.tsx", import.meta.url), "utf8");
const dashboardTodaySource = await readFile(new URL("../src/components/dashboard/DashboardToday.tsx", import.meta.url), "utf8");
const dashboardSource = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");

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
  cleaningDue: 5,
  additionalCompleted: 0,
  additionalDue: 3,
  wastageCount: 0,
  issueAttentionTaskIds: [],
};

assert.equal(getProgressPercent(0, 6), 0);
assert.equal(getProgressPercent(3, 6), 50);
assert.equal(getProgressPercent(6, 6), 100);
assert.equal(getProgressMessage(0, 6), "Let's get today's checks sorted.");
assert.equal(getProgressMessage(2, 6), "Good progress — keep going.");
assert.equal(getProgressMessage(6, 6), "Today's required checks are complete.");

assert.equal(getTaskStatus({ complete: false }), "not-started");
assert.equal(getTaskStatus({ complete: false, inProgress: true }), "in-progress");
assert.equal(getTaskStatus({ complete: false, dueLater: true }), "due-later");
assert.equal(getTaskStatus({ complete: false, attention: true }), "attention");
assert.equal(getTaskStatus({ complete: true, attention: true }), "completed-attention");

const zero = buildDailyTaskModels(base);
assert.equal(zero.filter((task) => task.required).length, 6);
assert.deepEqual(zero.map((task) => task.id), [
  "am-temperature",
  "am-security",
  "opening-checklist",
  "food-probes",
  "cleaning",
  "pm-temperature",
  "pm-security",
  "closing-checklist",
  "wastage",
  "additional-checks",
]);
assert.equal(zero.find((task) => task.id === "am-temperature")?.status, "not-started");
assert.equal(zero.find((task) => task.id === "pm-temperature")?.status, "due-later");
assert.equal(zero.find((task) => task.id === "additional-checks")?.status, "not-started");
assert.equal(zero.find((task) => task.id === "food-probes")?.required, false);
assert.equal(zero.find((task) => task.id === "food-probes")?.status, "not-started");
assert.equal(dailyTaskStatusLabel(zero.find((task) => task.id === "food-probes")), "As needed");
assert.equal(dailyTaskStatusLabel(zero.find((task) => task.id === "additional-checks")), "As needed");
assert.equal(dailyTaskStatusLabel(buildDailyTaskModels({ ...base, additionalDue: 0 }).find((task) => task.id === "additional-checks")), "Nothing due today");
const noCleaningDue = buildDailyTaskModels({ ...base, cleaningDue: 0 }).find((task) => task.id === "cleaning");
assert.equal(noCleaningDue?.status, "not-scheduled");
assert.equal(noCleaningDue?.detail, "Nothing due today");
assert.equal(dailyTaskStatusLabel(noCleaningDue), "Nothing due today");
const cleaningIssueWithNothingDue = buildDailyTaskModels({ ...base, cleaningDue: 0, issueAttentionTaskIds: ["cleaning"] }).find((task) => task.id === "cleaning");
assert.equal(cleaningIssueWithNothingDue?.status, "attention");
assert.equal(cleaningIssueWithNothingDue?.detail, "Nothing due today");
assert.equal(dailyTaskStatusLabel(cleaningIssueWithNothingDue), "Requires attention");
const noAdditionalDue = buildDailyTaskModels({ ...base, additionalDue: 0 }).find((task) => task.id === "additional-checks");
assert.equal(noAdditionalDue?.status, "not-scheduled");
assert.equal(noAdditionalDue?.detail, "Nothing due today");
assert.equal(dailyTaskStatusLabel(noAdditionalDue), "Nothing due today");
const additionalIssueWithNothingDue = buildDailyTaskModels({ ...base, additionalDue: 0, issueAttentionTaskIds: ["additional-checks"] }).find((task) => task.id === "additional-checks");
assert.equal(additionalIssueWithNothingDue?.status, "attention");
assert.equal(additionalIssueWithNothingDue?.detail, "Nothing due today");
assert.equal(dailyTaskStatusLabel(additionalIssueWithNothingDue), "Requires attention");
const additionalSection = journeySource.slice(journeySource.indexOf('aria-labelledby="additional-checks-heading"'), journeySource.indexOf('aria-labelledby="issues-heading"'));
assert.match(additionalSection, /<ul[^>]*>[\s\S]*<DailyTaskCard[\s\S]*<\/ul>/, "additional checks card has a valid list container");
assert.doesNotMatch(additionalSection, /<\/div>\s*<DailyTaskCard/, "additional checks card is not a direct section child");
assert.doesNotMatch(dashboardTodaySource, /viewTodayRecords/, "completed cards do not route through the general daily report");
for (const callback of ["viewTemperatureRecords", "viewChecklistRecords", "viewSecurityRecords", "viewCleaningRecords", "viewProbeRecords", "viewWastageRecords"]) {
  assert.match(dashboardTodaySource, new RegExp(callback), `${callback} is available for card-specific navigation`);
}
for (const destination of ["temperature", "checklist", "security", "cleaning", "probes", "wastage"]) {
  assert.match(dashboardSource, new RegExp(`kind: \\\"${destination}\\\"`), `${destination} records have a dedicated view`);
}
assert.match(dashboardSource, /OperationalRecordsView/, "completed checks render their own record view");

assert.deepEqual(
  getIssueAttentionTaskIds({
    issues: [
      { sourceTemperatureReadingId: "reading-am" },
      { sourceTemperatureReadingId: "reading-pm" },
      { sourceFoodCheckId: "probe" },
      { sourceAdditionalCompletionId: "additional" },
      { title: "opening checklist: Fire exit clear", category: "Food safety" },
      { title: "closing checklist: Lock doors", category: "Food safety" },
      { title: "Morning security: Door locked", category: "Operational task" },
      { title: "Evening security: Alarm set", category: "Operational task" },
      { title: "Clean surfaces: First pass", category: "Operational task" },
      { title: "Manual issue reported", category: "Food safety" },
    ],
    temperatureReadings: [
      { _id: "reading-am", roundId: "round-am" },
      { _id: "reading-pm", roundId: "round-pm" },
    ],
    temperatureRounds: [
      { _id: "round-am", session: "AM" },
      { _id: "round-pm", session: "PM" },
    ],
    structuredTasks: [
      { area: "security_am", title: "Morning security" },
      { area: "security_pm", title: "Evening security" },
      { area: "cleaning", title: "Clean surfaces" },
    ],
  }),
  [
    "am-temperature",
    "pm-temperature",
    "food-probes",
    "additional-checks",
    "opening-checklist",
    "closing-checklist",
    "am-security",
    "pm-security",
    "cleaning",
  ],
);

const allWorkflowAttention = buildDailyTaskModels({
  ...base,
  amComplete: true,
  pmComplete: true,
  openingComplete: true,
  closingComplete: true,
  amSecurityComplete: true,
  pmSecurityComplete: true,
  cleaningCompleted: 5,
  additionalCompleted: 3,
  issueAttentionTaskIds: [
    "am-temperature",
    "pm-temperature",
    "opening-checklist",
    "closing-checklist",
    "am-security",
    "pm-security",
    "food-probes",
    "cleaning",
    "additional-checks",
  ],
});
const completedAttentionTaskIds = [
  "am-temperature",
  "pm-temperature",
  "opening-checklist",
  "closing-checklist",
  "am-security",
  "pm-security",
  "cleaning",
  "additional-checks",
];
for (const taskId of completedAttentionTaskIds) {
  assert.equal(allWorkflowAttention.find((task) => task.id === taskId)?.status, "completed-attention");
}
assert.equal(allWorkflowAttention.find((task) => task.id === "food-probes")?.status, "attention");

const unrelatedIssue = buildDailyTaskModels({
  ...base,
  issueAttentionTaskIds: ["opening-checklist"],
});
assert.equal(unrelatedIssue.find((task) => task.id === "am-security")?.status, "not-started");
assert.equal(unrelatedIssue.find((task) => task.id === "cleaning")?.status, "not-started");

const partial = buildDailyTaskModels({
  ...base,
  amComplete: true,
  amInProgress: false,
  foodProbeCount: 2,
  cleaningCompleted: 2,
  issueAttentionTaskIds: ["opening-checklist"],
});
assert.equal(partial.find((task) => task.id === "am-temperature")?.status, "completed");
assert.equal(partial.find((task) => task.id === "opening-checklist")?.status, "attention");
assert.equal(partial.find((task) => task.id === "food-probes")?.detail, "2 recorded today");
assert.equal(partial.find((task) => task.id === "pm-security")?.status, "due-later");
assert.equal(partial.find((task) => task.id === "cleaning")?.status, "not-started");

const complete = buildDailyTaskModels({
  ...base,
  amComplete: true,
  pmComplete: true,
  openingComplete: true,
  closingComplete: true,
  amSecurityComplete: true,
  pmSecurityComplete: true,
  cleaningCompleted: 5,
  additionalCompleted: 3,
});
assert.equal(complete.filter((task) => task.required && task.status === "completed").length, 6);
assert.ok(complete.filter((task) => task.status === "completed").length >= 8);

console.log("Daily checks UI tests passed: 35/35");
