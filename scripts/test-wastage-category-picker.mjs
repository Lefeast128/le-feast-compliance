import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ALL_WASTAGE_CATEGORY,
  buildWastagePayload,
  emptyWastagePickerDraft,
  filterWastageProducts,
  getWastagePickerCategories,
  setWastagePickerMode,
  wastagePickerCategory,
} from "../src/lib/wastage-picker.ts";

const modal = await readFile(new URL("../src/components/WastageModal.tsx", import.meta.url), "utf8");
const catalogueService = await readFile(new URL("../src/server/catalogue/service.ts", import.meta.url), "utf8");

const products = [
  { id: "p3", plu: 3003, name: "Zesty Snack", group: "Snacks", department: "Food" },
  { id: "p1", plu: 1001, name: "Chicken Sandwich", group: "Sandwiches", department: "Food" },
  { id: "p2", plu: 2002, name: "Orange Juice", group: "", department: "Drinks" },
  { id: "p4", plu: 4004, name: "Uncategorised Item", group: null, department: null },
  { id: "p5", plu: 5005, name: "Inactive Item", group: "Snacks", department: "Food", active: false },
  { id: "p6", plu: 6006, name: "Excluded Item", group: "Snacks", department: "Food", excludedFromWastage: true },
];

assert.equal(wastagePickerCategory(products[0]), "Snacks");
assert.equal(wastagePickerCategory(products[2]), "Drinks");
assert.equal(wastagePickerCategory(products[3]), "Other");
assert.deepEqual(getWastagePickerCategories(products), [ALL_WASTAGE_CATEGORY, "Drinks", "Other", "Sandwiches", "Snacks"]);
assert.deepEqual(filterWastageProducts(products, ""), [products[1], products[2], products[3], products[0]]);
assert.deepEqual(filterWastageProducts(products, "sand", "Sandwiches"), [products[1]]);
assert.deepEqual(filterWastageProducts(products, "1001", "Sandwiches"), [products[1]]);
assert.deepEqual(filterWastageProducts(products, "", "Snacks"), [products[0]]);
assert.deepEqual(filterWastageProducts(products, "", ALL_WASTAGE_CATEGORY), [products[1], products[2], products[3], products[0]]);
assert.deepEqual(filterWastageProducts(products, "", "Drinks"), [products[2]]);
assert.equal(filterWastageProducts(products, "inactive").length, 0);
assert.equal(filterWastageProducts(products, "excluded").length, 0);

const categorySearch = filterWastageProducts(products, "juice", "Drinks");
assert.deepEqual(categorySearch, [products[2]]);
assert.deepEqual(filterWastageProducts(products, "", "Drinks"), [products[2]], "clearing search preserves category");

const catalogueDraft = { ...emptyWastagePickerDraft(), catalogueProductId: "p1", quantity: "1", teamMemberId: "member-1" };
assert.deepEqual(buildWastagePayload(catalogueDraft), { noWaste: false, catalogueProductId: "p1", quantity: "1", teamMemberId: "member-1" });
assert.equal(setWastagePickerMode(catalogueDraft, "adhoc").catalogueProductId, "");
assert.equal(setWastagePickerMode(catalogueDraft, "no_waste").mode, "no_waste");
assert.match(modal, /getWastagePickerCategories/);
assert.match(modal, /role="tablist" aria-label="Wastage category"/);
assert.match(modal, /filterWastageProducts\(products, search, selectedCategory\)/);
assert.match(modal, /buildWastagePayload\(draft\)/);
assert.match(catalogueService, /excludedFromWastage, false/);
assert.match(catalogueService, /eq\(catalogueProducts\.active, true\)/);
assert.match(catalogueService, /group: catalogueProducts\.group/);
assert.match(catalogueService, /department: catalogueProducts\.department/);

console.log("Wastage category picker tests passed: 25/25");
