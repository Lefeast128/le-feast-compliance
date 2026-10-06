import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateStructuredSteps, validateStructuredTaskResponse } from "../src/server/compliance/structured-task-service.ts";
import { buildInspectionChronology } from "../src/server/history/chronology.ts";

const steps = validateStructuredSteps([
  { id: "one", label: "Check seal", responseType: "confirm" },
  { id: "two", label: "Record count", responseType: "number" },
  { id: "three", label: "Note", responseType: "short_text" },
], "with_steps");
assert.deepEqual(steps.map(step => step.id), ["one", "two", "three"]);
assert.equal(validateStructuredTaskResponse(steps[0], "confirmed"), "confirmed");
assert.equal(validateStructuredTaskResponse(steps[1], "4"), "4");
assert.equal(validateStructuredTaskResponse(steps[2], "All clear"), "All clear");
assert.throws(() => validateStructuredSteps([], "with_steps"));
assert.throws(() => validateStructuredTaskResponse({ id: "yes", label: "Answer", responseType: "yes_no" }, "maybe"));
assert.deepEqual(validateStructuredSteps(undefined, "simple"), []);
const chronology = buildInspectionChronology({
  dayStart: new Date("2026-01-05T00:00:00.000Z"),
  dayEnd: new Date("2026-01-05T23:59:59.999Z"),
  structuredTaskResponses: [{ id: "response-1", taskArea: "opening", taskTitle: "Opening checks", stepLabel: "Check seal", responseValue: "confirmed", createdAt: "2026-01-05T08:00:00.000Z", teamMemberId: "member-1", teamMemberName: "Alex" }],
});
assert.equal(chronology[0].eventType, "structured_task_response");
assert.match(chronology[0].detail, /Check seal/);
assert.equal(chronology[0].teamMemberName, "Alex");

const [schema, migration, editor, navigation] = await Promise.all([
  readFile("src/server/db/schema.ts", "utf8"),
  readFile("drizzle/0013_structured_tasks.sql", "utf8"),
  readFile("src/components/ConfigEditor.tsx", "utf8"),
  readFile("src/components/dashboard/DashboardPrimitives.tsx", "utf8"),
]);
for (const table of ["checklistQuestions", "cleaningTasks", "securityQuestions"]) assert.match(schema, new RegExp(`${table}[\\s\\S]*taskType`));
assert.match(schema, /structuredTaskResponses/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS "structured_task_responses"/);
assert.match(editor, /Task with steps/);
assert.match(editor, /responseType/);
assert.match(navigation, /BottomNavigation/);
assert.match(navigation, /safe-area-inset-bottom/);
console.log("Structured task focused tests passed");
