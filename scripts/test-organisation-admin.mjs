import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const schema = await read("src/server/db/schema.ts");
const service = await read("src/server/management/organisation-service.ts");
const checklistService = await read("src/server/management/checklist-service.ts");
const ui = await read("src/components/OrganisationAdmin.tsx");
const admin = await read("src/components/AdminSetup.tsx");
const overview = await read("src/components/admin/AdminPrimitives.tsx");
const rest = await read("src/lib/rest-domain.ts");
const migration = await read("drizzle/0011_furry_speed_demon.sql");
const organisationApi = await read("api/admin/organisation.ts");
const trainingApi = await read("api/admin/organisation/training.ts");
const checklistApi = await read("api/admin/organisation/checklist.ts");

for (const [source, checks] of [
  [schema, ["password_hash", "centralChecklistItems", "centralTrainingPublications", "centralItemId", "centralPublicationId"]],
  [service, ["requireOrganisationAdmin", "publishCentralTraining", "publishCentralChecklist", "updateCentralTraining", "updateCentralChecklist", "db().transaction", "central_training_created", "central_checklist_created"]],
  [ui, ["UserAccessAdmin", "Training &amp; Documents", "Checklist Controls", "All stores", "Publish training", "Publish checklist item"]],
  [admin, ["OrganisationAdmin", "Central controls", "isOrganisationAdmin"]],
  [overview, ["Organisation standard"]],
  [rest, ["/api/admin/organisation", "publishTraining", "publishChecklist"]],
  [organisationApi, ["listOrganisationControls", "handleQuery"]],
  [trainingApi, ["publishCentralTraining", "handleMutation"]],
  [checklistApi, ["publishCentralChecklist", "handleMutation"]],
  [migration, ["password_hash", "central_checklist_items", "central_training_publications", "central_item_id", "central_publication_id"]],
]) for (const check of checks) assert.match(source, new RegExp(check.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${check} missing`);

assert.match(checklistService, /centralItemId/);
assert.match(checklistService, /Organisation standard checklist items are controlled centrally/);
assert.doesNotMatch(ui, /teamMembers|team_members/);
assert.doesNotMatch(schema, /password.*plain/i);

console.log("Organisation admin tests passed: 38/38");
