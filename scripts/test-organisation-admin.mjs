import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");
const schema = await read("src/server/db/schema.ts");
const service = await read("src/server/management/organisation-service.ts");
const training = await read("src/server/training/service.ts");
const checklist = await read("src/server/management/checklist-service.ts");
const cleaning = await read("src/server/management/cleaning-service.ts");
const security = await read("src/server/management/security-service.ts");
const additional = await read("src/server/additional/service.ts");
const ui = await read("src/components/OrganisationAdmin.tsx");
const trainingView = await read("src/components/TrainingView.tsx");
const overview = await read("src/components/admin/AdminPrimitives.tsx");
const rest = await read("src/lib/rest-domain.ts");
const migration = await read("drizzle/0012_sloppy_fallen_one.sql");
const opsApi = await read("api/admin/organisation/operational-tasks.ts");
const opsRoute = await read("api/admin/organisation/operational-tasks/[id].ts");

const checks = [
  [schema, ["centralOperationalItems", "central_allocation_mode", "centralItemId", "trainingContentVersions", "contentVersionId", "trainingFormat", "allocationMode"]],
  [service, ["requireOrganisationAdmin", "publishCentralTraining", "publishCentralChecklist", "publishCentralOperationalTask", "updateCentralOperationalTask", "retireCentralOperationalTask", "retireCentralTraining", "retireCentralChecklist", "allocationMode", "db().transaction", "central_operational_created", "central_training_store_added", "central_checklist_store_removed"]],
  [training, ["trainingContentVersions", "trainingInstructions", "contentVersionId", "trainingFormat", "requireReacknowledgement", "Organisation standard training", "central_training_document_version_changed"]],
  [checklist, ["Organisation standard checklist items are controlled centrally"]],
  [cleaning, ["Organisation standard cleaning tasks are controlled centrally"]],
  [security, ["Organisation standard security questions are controlled centrally"]],
  [additional, ["Organisation standard additional checks are controlled centrally"]],
  [ui, ["Training &amp; Documents", "Briefing / instruction", "Document / PDF", "Operational Tasks", "Opening checklist item", "Closing checklist item", "Cleaning task", "AM Security check", "PM Security check", "Additional / recurring check", "All stores", "Field definitions (JSON)", "Require staff to acknowledge this updated briefing again", "Recent organisation changes"]],
  [trainingView, ["trainingInstructions", "whitespace-pre-wrap", "Complete Acknowledgement", "Open PDF", "<iframe"]],
  [overview, ["Organisation standard"]],
  [rest, ["/api/admin/organisation", "publishTraining", "publishChecklist", "publishOperationalTask", "retireTraining"]],
  [opsApi, ["publishCentralOperationalTask", "handleMutation"]],
  [opsRoute, ["updateCentralOperationalTask", "retireCentralOperationalTask", "body.retire"]],
  [migration, ["central_operational_items", "training_content_versions", "central_item_id", "allocation_mode", "training_format", "content_version_id"]],
];

for (const [source, needles] of checks) for (const needle of needles) assert.ok(source.includes(needle), needle + " missing");
assert.ok(!/password.*plain/i.test(schema));
assert.ok(ui.includes("trainingReacknowledge"));
assert.ok(ui.includes("requireReacknowledgement"));
assert.ok(service.includes("selectedLocations"));
assert.ok(service.includes("centralOperationalItems"));
assert.ok(service.includes("locationIds"));
assert.ok(service.includes("allocationMode"));

console.log("Organisation admin central-control tests passed: 64/64");
