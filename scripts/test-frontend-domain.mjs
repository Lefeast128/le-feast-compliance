import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { apiRequest } from "../src/lib/api-client.ts";
import { buildWastagePayload, emptyWastagePickerDraft, filterWastageProducts, isPositiveQuantity, setWastagePickerMode } from "../src/lib/wastage-picker.ts";

const root = new URL("../src/", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");

const dashboard = await read("pages/Dashboard.tsx");
const admin = await read("components/AdminSetup.tsx");
const additionalAdmin = await read("components/AdditionalAdmin.tsx");
const restDomain = await read("lib/rest-domain.ts");
const main = await read("main.tsx");
const authHook = await read("hooks/use-auth.ts");

const frontendFiles = [];
async function collect(directory) {
  for (const entry of await readdir(new URL(directory, root), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else frontendFiles.push(path);
  }
}
await collect("");
const frontendSource = (await Promise.all(frontendFiles.map(read))).join("\n");

assert.match(restDomain, /\/api\/locations/);
assert.match(restDomain, /\/api\/dashboard\?locationId=/);
assert.match(restDomain, /\/api\/calendar\?locationId=/);
assert.match(restDomain, /\/api\/archive\?locationId=/);
assert.match(restDomain, /\/api\/training\/complete/);
assert.match(restDomain, /\/api\/additional\/complete/);
assert.match(restDomain, /\/api\/compliance\/temperature-rounds/);
assert.match(restDomain, /\/api\/compliance\/checklists\/responses/);
assert.match(restDomain, /\/api\/compliance\/security\/responses/);
assert.match(restDomain, /\/api\/compliance\/wastage/);
assert.match(restDomain, /\/api\/admin\/additional-requirements/);
assert.match(restDomain, /\/api\/documents\/upload/);
assert.match(restDomain, /\/api\/catalogue\/wastage/);
assert.match(dashboard, /setLocationId/);
assert.match(dashboard, /selectedDashboard/);
assert.match(dashboard, /StaffWastageModal/);
assert.match(dashboard, /restApi\.catalogue\.wastage/);
assert.match(restDomain, /rest:data-changed/);
assert.match(restDomain, /result\._id = result\.id/);
assert.match(frontendSource, /credentials: "include"/);
assert.doesNotMatch(frontendSource, /convex\/react|@convex-dev\/auth|ConvexProvider|ConvexReactClient|VITE_CONVEX_URL|quick-goldfish-711|convex\.cloud/);
assert.doesNotMatch(main, /ConvexProvider|ConvexReactClient|VITE_CONVEX_URL/);
assert.doesNotMatch(authHook, /localStorage|sessionStorage|signIn\(|signOut\(/);

const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  calls.push({ input, init });
  return new Response(JSON.stringify({ ok: true, data: { locations: [] } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
try {
  await apiRequest("/api/locations");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].input, "/api/locations");
} finally {
  globalThis.fetch = originalFetch;
}

const products = [
  { id: "sandwich", plu: 1234, name: "Chicken Sandwich", department: "Food" },
  { id: "soup", plu: 9876, name: "Tomato Soup", department: "Food" },
  { id: "milk", plu: 4321, name: "Semi-Skimmed Milk", department: "Dairy" },
];
assert.deepEqual(filterWastageProducts(products, "sand"), [products[0]]);
assert.deepEqual(filterWastageProducts(products, "1234"), [products[0]]);
assert.deepEqual(filterWastageProducts(products, "unrelated"), []);

let draft = { ...emptyWastagePickerDraft(), mode: "catalogue", catalogueProductId: "sandwich", quantity: "2.5", notes: " shift waste ", teamMemberId: "member-1" };
assert.deepEqual(buildWastagePayload(draft), { noWaste: false, catalogueProductId: "sandwich", quantity: "2.5", notes: "shift waste", teamMemberId: "member-1" });
const cataloguePayload = buildWastagePayload(draft);
assert.equal("adHocItemName" in cataloguePayload, false);
assert.equal("itemId" in cataloguePayload, false);

draft = setWastagePickerMode({ ...draft, adHocItemName: "Tomato Soup" }, "adhoc");
assert.equal(draft.catalogueProductId, "");
const adHocPayload = buildWastagePayload({ ...draft, quantity: "1", teamMemberId: "member-1" });
assert.deepEqual(adHocPayload, { noWaste: false, adHocItemName: "Tomato Soup", quantity: "1", notes: "shift waste", teamMemberId: "member-1" });
assert.equal("catalogueProductId" in adHocPayload, false);
assert.equal("itemId" in adHocPayload, false);

const noWasteDraft = setWastagePickerMode({ ...draft, quantity: "4", adHocItemName: "Something" }, "no_waste");
assert.equal(noWasteDraft.catalogueProductId, "");
assert.equal(noWasteDraft.adHocItemName, "");
assert.equal(noWasteDraft.quantity, "");
assert.deepEqual(buildWastagePayload({ ...noWasteDraft, teamMemberId: "member-1" }), { noWaste: true, notes: "shift waste", teamMemberId: "member-1" });
assert.equal("quantity" in buildWastagePayload({ ...noWasteDraft, teamMemberId: "member-1" }), false);
assert.equal("catalogueProductId" in buildWastagePayload({ ...noWasteDraft, teamMemberId: "member-1" }), false);
assert.equal("adHocItemName" in buildWastagePayload({ ...noWasteDraft, teamMemberId: "member-1" }), false);
assert.equal(isPositiveQuantity(""), false);
assert.equal(isPositiveQuantity("0"), false);
assert.equal(isPositiveQuantity("-1"), false);
assert.equal(isPositiveQuantity("0.25"), true);

console.log("Frontend domain tests passed: 37/37");
