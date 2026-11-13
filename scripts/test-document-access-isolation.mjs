import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assertControlledDocumentAccess } from "../src/server/documents/access.ts";

const document = {
  organisationId: "org-a",
  allocationMode: "selected",
  locationIds: ["store-a"],
};

assert.doesNotThrow(() => assertControlledDocumentAccess(document, "store-a", "org-a"));
assert.throws(() => assertControlledDocumentAccess(document, "store-b", "org-a"), /Document access denied/);
assert.throws(() => assertControlledDocumentAccess(document, undefined, "org-a"), /Document location is required/);
assert.throws(() => assertControlledDocumentAccess(document, "store-a", "org-b"), /Document access denied/);
assert.doesNotThrow(() => assertControlledDocumentAccess({ ...document, allocationMode: "all" }, "store-b", "org-a"));

const service = await readFile(new URL("../src/server/documents/service.ts", import.meta.url), "utf8");
assert.match(service, /assertControlledDocumentAccess\(controlled, requestedLocationId/);
assert.match(service, /if \(!controlled\.active\) throw new ApiError\(404, "Document not found"\)/);
assert.doesNotMatch(service, /controlledDocuments\.active, true/);

console.log("Controlled document isolation tests passed: allocation, organisation, omitted-location and retirement paths");
