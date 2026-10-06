import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const admin = await read("src/components/AdminSetup.tsx");
const cards = await read("src/components/admin/AdminFeatureCards.tsx");
const organisation = await read("src/components/OrganisationAdmin.tsx");
const organisationCards = await read("src/components/admin/OrganisationFeatureCards.tsx");
const storeOverview = await read("src/components/admin/AdminStoreOverview.tsx");

const storeFeatures = [
  "Issues & Reviews",
  "Compliance Reports",
  "Opening & Closing",
  "Cleaning",
  "Security Checks",
  "Additional Checks",
  "Training Requirements",
  "Team Members",
  "Fridges & Temperatures",
  "Probe Products",
  "Wastage",
];
for (const label of storeFeatures) assert.match(cards, new RegExp(label.replace(/[&]/g, "\\&")));
for (const label of ["User Access", "Training Requirements", "Operational Standards", "Document Library", "Organisation Activity"]) {
  assert.match(organisationCards, new RegExp(label.replace(/[&]/g, "\\&")));
}

assert.match(admin, /Selected store/);
assert.match(admin, /setFeature\(null\)/);
assert.match(cards, /<button/);
assert.match(cards, /aria-label={`Open \$\{title\}`}/);
assert.match(organisation, /OrganisationFeatureCards/);
assert.match(organisation, /section === "home"/);
assert.match(organisation, /Back to Organisation Admin/);
assert.match(storeOverview, /scope\?: AdminFeatureKey/);
assert.match(storeOverview, /show\("opening"\)/);
assert.match(storeOverview, /show\("cleaning"\)/);
assert.match(storeOverview, /show\("security"\)/);
assert.match(storeOverview, /show\("additional"\)/);
assert.match(storeOverview, /show\("training"\)/);
assert.match(storeOverview, /show\("fridges"\)/);

console.log("Admin navigation tests passed: 27/27");
