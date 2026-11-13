import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildBulkCompletionPlan, checklistProgress, eligibleSimpleTaskIds, isItemComplete } from "../src/lib/unified-checklist.ts";
import { structuredResponseStepForTask, validateStructuredTaskResponse } from "../src/server/compliance/structured-task-service.ts";
import { checklistDefinitionKey } from "../src/shared/unified-checklist.ts";

const task = (id, completionMode = "question") => ({ _id: id, taskType: "simple", completionMode, steps: [] });
const detailed = { _id: "steps", taskType: "with_steps", completionMode: "question", steps: [{ id: "one", label: "Seal", responseType: "confirm", required: true }, { id: "note", label: "Note", responseType: "short_text", required: false }] };
const legacy = [{ questionId: "legacy" }];
const structured = [{ taskId: "steps", stepId: "one" }];
const completeStructured = [...structured, { taskId: "task", stepId: "simple" }];
const questionDefinition = { id: "question-definition", question: "Fridges operating correctly?", taskType: "simple", completionMode: "question", steps: [] };
const taskDefinition = { id: "task-definition", name: "Clean preparation surfaces", taskType: "simple", completionMode: "task", steps: [] };
assert.equal(structuredResponseStepForTask(questionDefinition, "simple").responseType, "yes_no", "question-mode simple items use Yes/No structured responses");
assert.throws(() => validateStructuredTaskResponse(structuredResponseStepForTask(questionDefinition, "simple"), "confirmed"), /Choose yes or no/, "question-mode items reject confirmation bypasses");
assert.equal(validateStructuredTaskResponse(structuredResponseStepForTask(questionDefinition, "simple"), "no"), "no");
assert.equal(structuredResponseStepForTask(taskDefinition, "simple").responseType, "confirm", "task-mode simple items use confirmation responses");
assert.equal(validateStructuredTaskResponse(structuredResponseStepForTask(taskDefinition, "simple"), "confirmed"), "confirmed");
assert.throws(() => validateStructuredTaskResponse(structuredResponseStepForTask(taskDefinition, "simple"), "no"), /Confirmation is required/, "task-mode items reject negative confirmations");

assert.equal(isItemComplete(task("legacy"), legacy, structured), true, "legacy question response remains complete");
assert.equal(isItemComplete(detailed, legacy, structured), true, "required structured steps complete while optional steps remain optional");
assert.deepEqual(eligibleSimpleTaskIds([task("question"), task("task", "task"), task("done", "task")], [], completeStructured), ["done"], "bulk eligibility excludes legacy questions and completed tasks");
assert.deepEqual(buildBulkCompletionPlan([task("question"), task("task", "task"), task("done", "task")], ["question", "task", "done"], "joe", { task: "sarah" }, [], completeStructured), [{ taskId: "done", teamMemberId: "joe" }], "bulk completion excludes questions and already completed tasks while preserving overrides");
assert.deepEqual(buildBulkCompletionPlan([task("question"), task("task", "task"), task("done", "task")], ["question", "task", "done"], "joe", { task: "sarah" }, [], structured), [{ taskId: "task", teamMemberId: "sarah" }, { taskId: "done", teamMemberId: "joe" }], "individual task overrides are retained in the bulk plan");
assert.deepEqual(checklistProgress([task("legacy"), task("task", "task"), detailed], legacy, completeStructured), { complete: 3, total: 3, allComplete: true });
assert.deepEqual(buildBulkCompletionPlan([task("one", "task"), task("two", "task")], ["one", "two"], "joe", { two: "sarah" }), [{ taskId: "one", teamMemberId: "joe" }, { taskId: "two", teamMemberId: "sarah" }]);
const wordingVersion = { _id: "new-wording", versionRootId: "root", taskType: "simple", completionMode: "question", steps: [] };
assert.equal(isItemComplete(wordingVersion, [{ questionId: "old-wording", questionVersionRootId: "root", questionDefinitionKey: checklistDefinitionKey(wordingVersion) }], []), true, "wording-only versions retain same-day legacy completion");
const substantiveVersion = { ...wordingVersion, completionMode: "task" };
assert.equal(isItemComplete(substantiveVersion, [{ questionId: "old-wording", questionVersionRootId: "root", questionDefinitionKey: checklistDefinitionKey(wordingVersion) }], []), false, "completion-mode changes do not carry completion forward");
const stepsVersion = { _id: "new-steps", versionRootId: "steps-root", taskType: "with_steps", completionMode: "question", steps: [{ id: "one", label: "Seal", responseType: "confirm", required: true }] };
const oldStepsResponse = [{ taskId: "old-steps", stepId: "one", taskVersionRootId: "steps-root", taskDefinitionKey: checklistDefinitionKey(stepsVersion) }];
assert.equal(isItemComplete(stepsVersion, [], oldStepsResponse), true, "same structured definition carries a mid-day completion across wording-only versions");
assert.equal(isItemComplete({ ...stepsVersion, steps: [{ id: "one", label: "Seal", responseType: "yes_no", required: true }] }, [], oldStepsResponse), false, "step response changes remain outstanding");
assert.equal(isItemComplete({ ...stepsVersion, steps: [...stepsVersion.steps, { id: "two", label: "Date", responseType: "short_text", required: true }] }, [], oldStepsResponse), false, "new required steps remain outstanding");
assert.deepEqual(buildBulkCompletionPlan([task("one", "task"), task("two", "task")], ["one", "two"], "", { two: "sarah" }), [{ taskId: "one", teamMemberId: "" }, { taskId: "two", teamMemberId: "sarah" }], "bulk plan exposes missing attribution for confirmation validation");

const [component, workflow, dashboard, schema, migration, structuredService, checklistService, cleaningService, securityService, attribution] = await Promise.all([
  readFile("src/components/InlineChecklist.tsx", "utf8"),
  readFile("src/components/StructuredTaskWorkflow.tsx", "utf8"),
  readFile("src/pages/Dashboard.tsx", "utf8"),
  readFile("src/server/db/schema.ts", "utf8"),
  readFile("drizzle/0017_unified_checklist_modes.sql", "utf8"),
  readFile("src/server/compliance/structured-task-service.ts", "utf8"),
  readFile("src/server/compliance/checklist-service.ts", "utf8"),
  readFile("src/server/compliance/cleaning-service.ts", "utf8"),
  readFile("src/server/compliance/security-service.ts", "utf8"),
  readFile("src/components/dashboard/StaffAttribution.tsx", "utf8"),
]);
assert.match(component, /Select all simple tasks/);
assert.match(component, /aria-expanded=\{task\.taskType === "with_steps" \? expanded : undefined\}/, "only detailed checklist rows progressively disclose their controls");
assert.match(component, /aria-controls=\{task\.taskType === "with_steps" \? taskPanelId : undefined\}/, "expanded detailed rows expose an accessible panel relationship");
assert.match(component, /fixed inset-x-0 bottom-0/, "bulk review uses a safe-area-aware bottom action area");
assert.match(component, /pb-\[calc\(7rem\+env\(safe-area-inset-bottom\)\)\]/, "checklist content reserves space for action UI and safe areas");
assert.match(component, /<ActiveStaffControl/, "default staff attribution is explained once at the top");
assert.match(component, /MemberSelect = StaffAttributionLine/, "expanded items use the shared staff override");
assert.match(attribution, /Signed by:/, "expanded answers show their signing attribution inline");
assert.match(attribution, /pickerOpen &&/, "staff picker is disclosed only after Change is selected");
assert.match(attribution, /role="radiogroup"/, "active staff is exposed as a compact switcher");
assert.match(component, /Recorded step responses/, "completed detailed tasks retain an expandable evidence view");
assert.match(component, /animate-in fade-in-0 slide-in-from-top-1/, "expanded panels use a restrained progressive disclosure animation");
assert.match(component, /transition-transform duration-200 motion-reduce:transition-none/, "row expansion respects reduced motion");
assert.match(component, /Confirm simple tasks/);
assert.match(component, /Yes/);
assert.match(component, /Report an issue/);
assert.match(component, /taskType === "with_steps"/);
assert.match(component, /bulkPlan.map/);
assert.match(component, /setLocalStructuredResponses/);
assert.match(component, /response.responseValue/);
assert.match(workflow, /responseType: task\.completionMode === "task" \? "confirm" : "yes_no"/);
assert.match(workflow, /taskVersionRootId: task\.versionRootId/);
assert.match(dashboard, /structuredResponses=\{workflows\.active\?\.structuredTaskResponses/);
assert.match(schema, /completionMode: text\("completion_mode"\)/);
assert.match(migration, /checklist_questions/);
assert.match(structuredService, /structuredResponseStepForTask/);
assert.match(checklistService, /Simple completion tasks must use the structured task workflow/);
assert.match(cleaningService, /Yes\/No cleaning questions must use the structured task workflow/);
assert.match(securityService, /Simple completion tasks must use the structured task workflow/);
console.log("Unified checklist focused tests passed");
