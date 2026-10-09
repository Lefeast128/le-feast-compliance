import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { submitTemperatureRound } from "../src/components/dashboard/temperature-round.ts";

const workflowSource = await readFile(new URL("../src/components/dashboard/useDashboardWorkflows.ts", import.meta.url), "utf8");
const entrySource = await readFile(new URL("../src/components/TemperatureRoundEntry.tsx", import.meta.url), "utf8");
const beginStart = workflowSource.indexOf("function beginRound");
const completeStart = workflowSource.indexOf("async function completeTemperatureRound");
const beginBody = workflowSource.slice(beginStart, completeStart);
assert.doesNotMatch(beginBody, /startRound\(/, "opening a temperature workflow must not create a round");
assert.match(beginBody, /setRoundId\(null\)/);
assert.match(workflowSource, /const result = await submitTemperatureRound\(/);
assert.match(workflowSource, /roundSubmittingRef\.current = true/);
assert.match(entrySource, /disabled=\{submitting \|\|/);

const calls = { start: [], readings: [], completes: [] };
const equipment = [{ _id: "fridge-1" }, { _id: "fridge-2" }];
const temperatures = { "fridge-1": "4", "fridge-2": "5" };
const result = await submitTemperatureRound({
  roundId: null,
  locationId: "location-1",
  session: "AM",
  teamMemberId: "member-1",
  equipment,
  temperatures,
  startRound: async (input) => { calls.start.push(input); return "round-1"; },
  recordTemperature: async (input) => { calls.readings.push(input); return { issueId: null }; },
  completeRound: async (input) => { calls.completes.push(input); },
});
assert.equal(calls.start.length, 1, "one submission creates one round");
assert.deepEqual(calls.start[0], { locationId: "location-1", session: "AM", teamMemberId: "member-1" }, "new round carries the selected staff member");
assert.deepEqual(calls.readings.map(input => input.roundId), ["round-1", "round-1"]);
assert.deepEqual(calls.completes, [{ roundId: "round-1", locationId: "location-1", session: "AM", teamMemberId: "member-1" }]);
assert.equal(result.issues.length, 0);

const failed = await submitTemperatureRound({
  roundId: null,
  locationId: "location-1",
  session: "PM",
  teamMemberId: "member-1",
  equipment: [equipment[0]],
  temperatures: { "fridge-1": "9" },
  startRound: async () => "round-2",
  recordTemperature: async input => ({ issueId: input.roundId === "round-2" ? "issue-1" : null }),
  completeRound: async () => { throw new Error("failed readings must wait for corrective action"); },
});
assert.equal(failed.roundId, "round-2");
assert.equal(failed.issues[0].issueId, "issue-1");

const recoveryCalls = { readings: [], completes: [] };
const recovered = await submitTemperatureRound({
  roundId: "round-recovery",
  locationId: "location-1",
  session: "AM",
  teamMemberId: "member-2",
  equipment: [{ _id: "fridge-1" }, { _id: "fridge-2" }, { _id: "fridge-3" }, { _id: "fridge-4" }],
  temperatures: { "fridge-1": "4", "fridge-2": "5", "fridge-3": "6", "fridge-4": "7" },
  existingReadings: [{ equipmentId: "fridge-1" }, { equipmentId: "fridge-2" }],
  startRound: async () => { throw new Error("recovery must use the existing round"); },
  recordTemperature: async input => { recoveryCalls.readings.push(input); return { result: "pass" }; },
  completeRound: async input => { recoveryCalls.completes.push(input); },
});
assert.equal(recovered.roundId, "round-recovery");
assert.deepEqual(recoveryCalls.readings.map(input => input.equipmentId), ["fridge-3", "fridge-4"], "recovery only records outstanding fridges");
assert.equal(recoveryCalls.completes.length, 1, "recovered round completes through one idempotent path");

let retryCalls = 0;
const partial = await submitTemperatureRound({
  roundId: "round-retry",
  locationId: "location-1",
  session: "PM",
  teamMemberId: "member-2",
  equipment: [{ _id: "fridge-1" }, { _id: "fridge-2" }],
  temperatures: { "fridge-1": "4", "fridge-2": "5" },
  recordTemperature: async input => {
    retryCalls += 1;
    if (retryCalls === 1) return { result: "pass" };
    throw new Error("temporary network failure");
  },
  startRound: async () => "round-retry",
  completeRound: async () => undefined,
});
assert.match(partial.error?.message ?? "", /temporary network failure/);
const retryReadings = [];
const retry = await submitTemperatureRound({
  roundId: "round-retry",
  locationId: "location-1",
  session: "PM",
  teamMemberId: "member-2",
  equipment: [{ _id: "fridge-1" }, { _id: "fridge-2" }],
  temperatures: { "fridge-1": "4", "fridge-2": "5" },
  existingReadings: [{ equipmentId: "fridge-1" }],
  recordTemperature: async input => { retryReadings.push(input.equipmentId); return { result: "pass" }; },
  startRound: async () => "round-retry",
  completeRound: async () => undefined,
});
assert.equal(retry.issues.length, 0, "partial retry completes without a duplicate reading");
assert.deepEqual(retryReadings, ["fridge-2"], "retry does not submit a reading that was already saved");

let reconciliationCalls = 0;
const conflict = await submitTemperatureRound({
  roundId: "round-conflict",
  locationId: "location-1",
  session: "AM",
  teamMemberId: "member-1",
  equipment: [{ _id: "fridge-1", name: "Main fridge" }],
  temperatures: { "fridge-1": "9" },
  recordTemperature: async () => {
    const error = new Error("This fridge already has a reading in this round");
    error.status = 409;
    throw error;
  },
  reconcileReading: async ({ roundId, equipmentId }) => {
    reconciliationCalls += 1;
    assert.equal(roundId, "round-conflict");
    assert.equal(equipmentId, "fridge-1");
    return {
      reading: { equipmentId, result: "fail", issueId: "issue-conflict", temperature: 9, teamMemberId: "member-original", createdAt: "2026-10-08T08:00:00.000Z" },
      issue: { issueId: "issue-conflict", actionRecorded: false },
    };
  },
  startRound: async () => "round-conflict",
  completeRound: async () => { throw new Error("an unresolved reconciled issue cannot complete"); },
});
assert.equal(reconciliationCalls, 1, "409 responses reconcile against the authoritative server reading");
assert.equal(conflict.savedReadings[0].teamMemberId, "member-original", "reconciliation preserves the original reading attribution");
assert.equal(conflict.issues[0].issueId, "issue-conflict", "reconciled failures remain outstanding until action is recorded");
assert.match(conflict.savedReadings[0].createdAt, /^2026-10-08/, "reconciliation preserves the original reading timestamp");

let unresolvedCompletionCalls = 0;
await submitTemperatureRound({
  roundId: "round-existing-failure",
  locationId: "location-1",
  session: "PM",
  teamMemberId: "member-2",
  equipment: [{ _id: "fridge-1", name: "Main fridge" }],
  temperatures: { "fridge-1": "9" },
  existingReadings: [{ equipmentId: "fridge-1", result: "fail", issueId: "issue-existing" }],
  existingIssues: [{ _id: "fridge-1", name: "Main fridge", issueId: "issue-existing", temperature: 9, actionRecorded: false }],
  startRound: async () => "round-existing-failure",
  recordTemperature: async () => { throw new Error("the existing reading must not be resubmitted"); },
  completeRound: async () => { unresolvedCompletionCalls += 1; },
});
assert.equal(unresolvedCompletionCalls, 0, "a resumed failed reading without action cannot complete the round");

let actionRecordedCompletionCalls = 0;
await submitTemperatureRound({
  roundId: "round-existing-action",
  locationId: "location-1",
  session: "PM",
  teamMemberId: "member-2",
  equipment: [{ _id: "fridge-1", name: "Main fridge" }],
  temperatures: { "fridge-1": "9" },
  existingReadings: [{ equipmentId: "fridge-1", result: "fail", issueId: "issue-existing" }],
  existingIssues: [{ _id: "fridge-1", name: "Main fridge", issueId: "issue-existing", temperature: 9, actionRecorded: true }],
  startRound: async () => "round-existing-action",
  recordTemperature: async () => { throw new Error("the existing reading must not be resubmitted"); },
  completeRound: async () => { actionRecordedCompletionCalls += 1; },
});
assert.equal(actionRecordedCompletionCalls, 1, "a resumed failed reading with recorded action can complete the round without a recheck");

console.log("Lazy temperature round tests passed: open/cancel are local-only, submission uses one shared round, completion and failed-reading paths preserve the round ID");
