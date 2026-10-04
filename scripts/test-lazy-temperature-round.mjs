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

console.log("Lazy temperature round tests passed: open/cancel are local-only, submission uses one shared round, completion and failed-reading paths preserve the round ID");
