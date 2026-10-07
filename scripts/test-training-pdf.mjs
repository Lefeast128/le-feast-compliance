import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const service = await read("src/server/management/organisation-service.ts");
const training = await read("src/server/training/service.ts");
const dashboard = await read("src/server/dashboard/repository.ts");
const admin = await read("src/components/OrganisationAdmin.tsx");
const trainingView = await read("src/components/TrainingView.tsx");
const rest = await read("src/lib/rest-domain.ts");
const documentRoute = await read("api/documents/[id].ts");

const checks = [
  [service, ["A PDF is required for document training", "documentSelected", "attachmentStatus", "attached", "missing", "safeTrainingRequirements"]],
  [training, ["currentDocumentVersionId", "trainingFormat: \"document\"", "centralTrainingPublications", "documentUrl: requirement.trainingFormat === \"document\""]],
  [dashboard, ["documentUrl: requirement.trainingFormat === \"document\""]],
  [admin, ["Training type", "Briefing / instruction", "Document / PDF", "aria-pressed", "Current PDF attached", "Required for Document / PDF training", "Attach missing PDF", "PDF attachment incomplete", "documentSelected", "attachmentStatus"]],
  [trainingView, ["<iframe", "Open PDF", "documentUrl", "whitespace-pre-wrap"]],
  [rest, ["/api/documents/upload", "attachTrainingDocument"]],
  [documentRoute, ["documentForAccess", "readPrivateDocument", "Content-Disposition"]],
];

let count = 0;
for (const [source, needles] of checks) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${needle} missing`);
    count += 1;
  }
}

assert.doesNotMatch(admin, /Optional supporting document/);
assert.doesNotMatch(trainingView, /View supporting PDF/);
assert.doesNotMatch(service, /pathname.*return|storageId.*return/);
assert.match(documentRoute, /requireContext/);

console.log(`Training PDF attachment tests passed: ${count}/${count}`);
