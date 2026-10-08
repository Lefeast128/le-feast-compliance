import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildBulkCompletionPlan, checklistProgress, eligibleSimpleTaskIds, isItemComplete } from "../src/lib/unified-checklist.ts";

const task = (id, completionMode = "question") => ({ _id: id, taskType: "simple", completionMode, steps: [] });
const detailed = { _id: "steps", taskType: "with_steps", completionMode: "question", steps: [{ id: "one", label: "Seal", responseType: "confirm", required: true }, { id: "note", label: "Note", responseType: "short_text", required: false }] };
const legacy = [{ questionId: "legacy" }];
const structured = [{ taskId: "steps", stepId: "one" }];
const completeStructured = [...structured, { taskId: "task", stepId: "simple" }];

assert.equal(isItemComplete(task("legacy"), legacy, structured), true, "legacy question response remains complete");
assert.equal(isItemComplete(detailed, legacy, structured), true, "required structured steps complete while optional steps remain optional");
assert.deepEqual(eligibleSimpleTaskIds([task("question"), task("task", "task"), task("done", "task")], [], completeStructured), ["done"], "bulk eligibility excludes legacy questions and completed tasks");
assert.deepEqual(buildBulkCompletionPlan([task("question"), task("task", "task"), task("done", "task")], ["question", "task", "done"], "joe", { task: "sarah" }, [], completeStructured), [{ taskId: "done", teamMemberId: "joe" }], "bulk completion excludes questions and already completed tasks while preserving overrides");
assert.deepEqual(buildBulkCompletionPlan([task("question"), task("task", "task"), task("done", "task")], ["question", "task", "done"], "joe", { task: "sarah" }, [], structured), [{ taskId: "task", teamMemberId: "sarah" }, { taskId: "done", teamMemberId: "joe" }], "individual task overrides are retained in the bulk plan");
assert.deepEqual(checklistProgress([task("legacy"), task("task", "task"), detailed], legacy, completeStructured), { complete: 3, total: 3, allComplete: true });
assert.deepEqual(buildBulkCompletionPlan([task("one", "task"), task("two", "task")], ["one", "two"], "joe", { two: "sarah" }), [{ taskId: "one", teamMemberId: "joe" }, { taskId: "two", teamMemberId: "sarah" }]);

const [component, dashboard, schema, migration] = await Promise.all([
  readFile("src/components/InlineChecklist.tsx", "utf8"),
  readFile("src/pages/Dashboard.tsx", "utf8"),
  readFile("src/server/db/schema.ts", "utf8"),
  readFile("drizzle/0017_unified_checklist_modes.sql", "utf8"),
]);
assert.match(component, /Select all simple tasks/);
assert.match(component, /Confirm simple tasks/);
assert.match(component, /Yes/);
assert.match(component, /Report an issue/);
assert.match(component, /taskType === "with_steps"/);
assert.match(dashboard, /structuredResponses=\{workflows\.active\?\.structuredTaskResponses/);
assert.match(schema, /completionMode: text\("completion_mode"\)/);
assert.match(migration, /checklist_questions/);
console.log("Unified checklist focused tests passed");
