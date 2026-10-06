import assert from "node:assert/strict";
import {
  buildDailyTaskModels,
  getProgressMessage,
  getProgressPercent,
  getTaskStatus,
} from "../src/components/dashboard/daily-checks-model.ts";

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
  hasOpenIssues: false,
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
assert.equal(getTaskStatus({ complete: true, attention: true }), "completed");

const zero = buildDailyTaskModels(base);
assert.equal(zero.filter((task) => task.required).length, 6);
assert.equal(zero.find((task) => task.id === "am-temperature")?.status, "not-started");
assert.equal(zero.find((task) => task.id === "pm-temperature")?.status, "due-later");
assert.equal(zero.find((task) => task.id === "additional-checks")?.status, "not-started");

const partial = buildDailyTaskModels({
  ...base,
  amComplete: true,
  amInProgress: false,
  foodProbeCount: 2,
  cleaningCompleted: 2,
  hasOpenIssues: true,
});
assert.equal(partial.find((task) => task.id === "am-temperature")?.status, "completed");
assert.equal(partial.find((task) => task.id === "opening-checklist")?.status, "attention");
assert.equal(partial.find((task) => task.id === "food-probes")?.detail, "2 recorded today");
assert.equal(partial.find((task) => task.id === "pm-security")?.status, "due-later");

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

console.log("Daily checks UI tests passed: 18/18");
