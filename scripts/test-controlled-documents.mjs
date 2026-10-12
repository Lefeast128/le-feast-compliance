import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const schema = await read("src/server/db/schema.ts");
const migration = await read("drizzle/0018_controlled_documents.sql");
const service = await read("src/server/documents/controlled-service.ts");
const admin = await read("src/components/ControlledDocumentsAdmin.tsx");
const rest = await read("src/lib/rest-domain.ts");
const access = await read("src/server/documents/service.ts");
const route = await read("api/admin/organisation/controlled-documents.ts");

for (const needle of ["controlledDocuments", "controlledDocumentVersions", "controlledDocumentId", "controlledDocumentVersionId", "requireTrainingAcknowledgement", "acknowledgementDeadline"]) assert.ok(schema.includes(needle), `${needle} missing from schema`);
for (const needle of ["CREATE TABLE IF NOT EXISTS \"controlled_documents\"", "CREATE TABLE IF NOT EXISTS \"controlled_document_versions\"", "display_in_library", "require_training_acknowledgement", "ON DELETE restrict"]) assert.ok(migration.includes(needle), `${needle} missing from migration`);
for (const needle of ["createControlledDocument", "replaceControlledDocument", "requiresReacknowledgement", "trainingCompletions", "requireOrganisationAdmin", "requireLocationAccess", "controlled_document_version_published"]) assert.ok(service.includes(needle), `${needle} missing from service`);
for (const needle of ["Publish once, use everywhere", "Display in Library", "Require Training acknowledgement", "Acknowledgement overview", "PDF · Maximum 100 MB", "Retire"]) assert.ok(admin.includes(needle), `${needle} missing from admin UI`);
for (const needle of ["controlledDocuments", "/api/admin/organisation/controlled-documents", "acknowledgements"]) assert.ok(rest.includes(needle), `${needle} missing from REST domain`);
for (const needle of ["controlledDocumentVersions", "requestedLocationId", "Document access denied"]) assert.ok(access.includes(needle), `${needle} missing from access control`);
assert.match(route, /listControlledDocuments/);
assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|TRUNCATE/i);
console.log("Controlled Documents tests passed");
