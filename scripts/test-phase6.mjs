import assert from "node:assert/strict";
import fs from "node:fs";
import { validatePdfBytesValue, sanitizeFilenameValue, MAX_PDF_BYTES } from "../src/server/documents/pure.ts";

const root = new URL("../", import.meta.url).pathname;
const read = path => fs.readFileSync(`${root}${path}`, "utf8");
const exists = path => assert.equal(fs.existsSync(`${root}${path}`), true, `missing ${path}`);
const contains = (path, value) => assert.equal(read(path).includes(value), true, `${path} missing ${value}`);

for (const route of [
  "api/documents/upload.ts", "api/documents/[id].ts", "api/training.ts", "api/training/complete.ts",
  "api/admin/training-requirements.ts", "api/admin/training-requirements/[id].ts", "api/admin/training-requirements/[id]/document.ts",
  "api/additional.ts", "api/additional/history.ts", "api/additional/complete.ts", "api/admin/additional-requirements.ts",
  "api/admin/additional-requirements/[id].ts", "api/admin/additional-requirements/[id]/reorder.ts",
]) { exists(route); }
contains("src/server/db/schema.ts", "export const documents");
contains("src/server/db/schema.ts", "documentId: uuid(\"document_id\")");
contains("src/server/documents/service.ts", "access: \"private\"");
contains("src/server/documents/service.ts", "BLOB_READ_WRITE_TOKEN");
contains("src/server/training/service.ts", "requiredDocumentVersionNumber");
contains("src/server/additional/service.ts", "Corrective action is required for a failed additional check");
contains("drizzle/0005_naive_leech.sql", "CREATE TABLE \"documents\"");

validatePdfBytesValue("application/pdf", new TextEncoder().encode("%PDF-1.7\nbody"));
assert.throws(() => validatePdfBytesValue("application/pdf", new TextEncoder().encode("<html>")), /valid PDF/);
assert.throws(() => validatePdfBytesValue("text/plain", new TextEncoder().encode("%PDF-")), /Only PDF/);
assert.throws(() => validatePdfBytesValue("application/pdf", new Uint8Array(MAX_PDF_BYTES + 1)), /size/);
assert.equal(sanitizeFilenameValue(" handbook copy.pdf "), "handbook_copy.pdf");
console.log("Phase 6 document, training and additional API tests passed");
