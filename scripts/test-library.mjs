import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const schema = await read("src/server/db/schema.ts");
const migration = await read("drizzle/0016_library_documents.sql");
const service = await read("src/server/library/service.ts");
const library = await read("src/components/LibraryView.tsx");
const admin = await read("src/components/OrganisationLibraryAdmin.tsx");
const nav = await read("src/components/dashboard/DashboardPrimitives.tsx");
const dashboard = await read("src/pages/Dashboard.tsx");
const rest = await read("src/lib/rest-domain.ts");
const reader = await read("api/library/documents/[id].ts");
const upload = await read("src/server/documents/service.ts");

const checks = [
  [schema, ["libraryDocuments", "libraryDocumentVersions", "library_documents", "library_document_versions"]],
  [migration, ["CREATE TABLE IF NOT EXISTS \"library_documents\"", "CREATE TABLE IF NOT EXISTS \"library_document_versions\"", "allocation_mode", "ON DELETE restrict"]],
  [service, ["requireOrganisationAdmin", "requireLocationAccess", "allocationMode", "locationIds", "library_document_published", "library_document_retired", "library_document_pdf_replaced"]],
  [library, ["Library", "Search documents", "Open ${document.title}", "iframe", "Open PDF", "documentUrl", "Important"]],
  [admin, ["Document Library", "library_document", "All stores", "Publish document", "Retire this library document"]],
  [nav, ["Library", "BookOpen", "active === key", "safe-area-inset-bottom"]],
  [dashboard, ["view === \"library\"", "LibraryView", "onLibrary"]],
  [rest, ["/api/library?locationId=", "/api/admin/organisation/library"]],
  [reader, ["requireContext", "libraryDocumentForAccess", "Content-Disposition", "readLibraryDocument"]],
  [upload, ["library_document", "validatePdfBytes"]],
];

let count = 0;
for (const [source, needles] of checks) for (const needle of needles) {
  assert.ok(source.includes(needle), `${needle} missing`);
  count += 1;
}
assert.doesNotMatch(library, /View PDF/);
assert.doesNotMatch(library, /storageId|pathname|blob/);
assert.doesNotMatch(service, /trainingCompletions|trainingCompletions\.(insert|update|delete)/);
console.log(`Library tests passed: ${count}/${count}`);
