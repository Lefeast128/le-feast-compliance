import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MAX_PDF_BYTES, validatePdfBytesValue } from "../src/server/documents/pure.ts";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const source = await read("src/server/documents/service.ts");
const api = await read("src/lib/rest-domain.ts");
const uploadRoute = await read("api/documents/upload-token.ts");
const finalizeRoute = await read("api/documents/finalize.ts");
const cleanupRoute = await read("api/documents/cleanup.ts");
const library = await read("src/components/OrganisationLibraryAdmin.tsx");
const training = await read("src/components/ConfigEditor.tsx");
const storeTraining = await read("src/components/admin/AdminStoreOverview.tsx");
const organisationTraining = await read("src/components/OrganisationAdmin.tsx");

assert.equal(MAX_PDF_BYTES, 25 * 1024 * 1024);
const pdf = new Uint8Array(11.6 * 1024 * 1024);
pdf.set(new TextEncoder().encode("%PDF-1.7"));
validatePdfBytesValue("application/pdf", pdf);
const maxPdf = new Uint8Array(MAX_PDF_BYTES);
maxPdf.set(new TextEncoder().encode("%PDF-1.7"));
validatePdfBytesValue("application/pdf", maxPdf);
assert.throws(() => validatePdfBytesValue("application/pdf", new Uint8Array(MAX_PDF_BYTES + 1)), /size/);
assert.throws(() => validatePdfBytesValue("text/plain", pdf), /Only PDF/);

for (const [name, value, needles] of [
  ["service", source, ["MAX_PDF_BYTES", "generateClientTokenFromReadWriteToken", "maximumSizeInBytes", "validateStoredPdf", "cleanupBlob", "head(", "access: \"private\""]],
  ["upload route", uploadRoute, ["createUploadGrant", "handleMutation"]],
  ["finalize route", finalizeRoute, ["finalizeDocument", "handleMutation"]],
  ["cleanup route", cleanupRoute, ["cleanupUpload", "handleMutation"]],
  ["documents API", api, ["put as putBlob", "/api/documents/upload-token", "/api/documents/finalize", "/api/documents/cleanup", "multipart", "This PDF is larger than the 25 MB maximum."]],
  ["library admin", library, ["PDF · Maximum 25 MB", "Uploading PDF…", "documentsApi.upload"]],
  ["store training admin", storeTraining, ["documentsApi.upload"]],
  ["organisation training admin", organisationTraining, ["PDF · Maximum 25 MB", "Uploading PDF…"]],
]) {
  for (const needle of needles) assert.ok(value.includes(needle), `${name} missing ${needle}`);
}

assert.doesNotMatch(api, /btoa\(|file\.arrayBuffer\(\)/);
assert.match(source, /allowedContentTypes: \["application\/pdf"\]/);
assert.match(source, /purpose === "library_document".*requireOrganisationAdmin/s);
console.log("Large PDF upload tests passed");
