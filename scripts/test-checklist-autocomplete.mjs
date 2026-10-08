import assert from "node:assert/strict";
import { checklistIsReadyToSignOff } from "../src/lib/checklist-autocomplete.ts";
import { checklistDefinitionKey } from "../src/shared/unified-checklist.ts";

const items = [
  { _id: "question-1", taskType: "simple", completionMode: "question", versionRootId: "question-root" },
  { _id: "task-1", taskType: "simple", completionMode: "task", versionRootId: "task-root" },
  { _id: "steps-1", taskType: "with_steps", versionRootId: "steps-root", steps: [
    { id: "check", label: "Check", responseType: "confirm", required: true },
    { id: "note", label: "Note", responseType: "short_text", required: false },
  ] },
];

const legacy = [{ questionId: "question-old", questionVersionRootId: "question-root", questionDefinitionKey: checklistDefinitionKey(items[0]) }];
const structured = [
  { taskId: "task-1", stepId: "simple", taskVersionRootId: "task-root" },
  { taskId: "steps-old", stepId: "check", taskVersionRootId: "steps-root", taskDefinitionKey: checklistDefinitionKey(items[2]) },
];

assert.equal(checklistIsReadyToSignOff(items, legacy, structured), true, "legacy and structured evidence can complete one checklist");
assert.equal(checklistIsReadyToSignOff(items, legacy, structured.slice(0, 1)), false, "required steps prevent early automatic completion");
assert.equal(checklistIsReadyToSignOff(items, [], structured), false, "an unanswered question cannot be signed off");
assert.match(await (await import("node:fs/promises")).readFile(new URL("../src/components/InlineChecklist.tsx", import.meta.url), "utf8"), /maybeAutoSignOff/);
assert.match(await (await import("node:fs/promises")).readFile(new URL("../src/components/InlineChecklist.tsx", import.meta.url), "utf8"), /Finish recording completion/);
assert.doesNotMatch(await (await import("node:fs/promises")).readFile(new URL("../src/components/InlineChecklist.tsx", import.meta.url), "utf8"), /Checklist sign-off/);
const structuredWorkflow = await (await import("node:fs/promises")).readFile(new URL("../src/components/StructuredTaskWorkflow.tsx", import.meta.url), "utf8");
assert.match(structuredWorkflow, /Finish recording completion/);
const structuredServiceSource = await (await import("node:fs/promises")).readFile(new URL("../src/server/compliance/structured-task-service.ts", import.meta.url), "utf8");
const checklistServiceSource = await (await import("node:fs/promises")).readFile(new URL("../src/server/compliance/checklist-service.ts", import.meta.url), "utf8");
const securityServiceSource = await (await import("node:fs/promises")).readFile(new URL("../src/server/compliance/security-service.ts", import.meta.url), "utf8");
assert.match(structuredServiceSource, /maybeAutoSignOffStructuredChecklist/);
assert.match(checklistServiceSource, /maybeAutoSignOffStructuredChecklist\(tx/);
assert.match(securityServiceSource, /maybeAutoSignOffStructuredChecklist\(tx/);
assert.match(structuredServiceSource, /onConflictDoNothing/);
console.log("Checklist auto-completion tests passed: mixed legacy/structured evidence, required-step gating and no redundant sign-off controls");
