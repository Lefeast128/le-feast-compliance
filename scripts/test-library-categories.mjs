import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const categories = await read("src/shared/library-categories.ts");
const library = await read("src/components/LibraryView.tsx");
const admin = await read("src/components/OrganisationLibraryAdmin.tsx");
const service = await read("src/server/library/service.ts");

for (const label of ["EHO & Food Safety Certificates", "Le Feast Company Documents", "Licensing"]) assert.match(categories, new RegExp(label.replace(/[&]/g, "\\&")));
assert.match(library, /libraryCategoryLabel/);
assert.match(library, /libraryCategorySort/);
assert.match(admin, /LIBRARY_CATEGORY_OPTIONS/);
assert.match(admin, /libraryCategoryLabel/);
assert.match(service, /allocationMode/);
assert.doesNotMatch(library, /storageId|pathname|blob/);
console.log("Library category tests passed: three groups, legacy display and allocation-preserving admin editing");
