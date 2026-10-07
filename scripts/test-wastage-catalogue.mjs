import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const catalogue = await read("src/components/WastageCatalogueAdmin.tsx");
const adminSetup = await read("src/components/AdminSetup.tsx");

assert.doesNotMatch(catalogue, /onOpenReports/);
assert.doesNotMatch(catalogue, /Compliance reports/);
for (const needle of [
  "onClose",
  "Back to setup",
  "Refresh TouchOffice catalogue",
  "Search product or PLU",
  "changeStore",
  "filterCatalogueProducts",
  "updateWastage",
]) assert.match(catalogue, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${needle} missing`);
assert.doesNotMatch(adminSetup, /onOpenReports=\{\(\) => setFeature\("reports"\)\}/);
assert.match(adminSetup, /<WastageCatalogueAdmin/);

console.log("Wastage catalogue navigation cleanup tests passed: 10/10");
