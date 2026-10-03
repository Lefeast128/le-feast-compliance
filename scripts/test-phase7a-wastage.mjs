import assert from "node:assert/strict";
import fs from "node:fs";
import { assertCatalogueProductUsable, catalogueWastageSnapshot, isUsableCatalogueProduct, parseWastageMode } from "../src/server/wastage/catalogue.ts";
import { buildWastageExportRows } from "../src/server/wastage/pure.ts";
import { requirePositiveNumberString } from "../src/server/compliance/validation.ts";

const member = "member-id";
const productId = "product-id";
const validProduct = { id: productId, locationId: "location-a", plu: 1234, name: "TouchOffice Sandwich", wastageCategory: "Chilled", active: true, excludedFromWastage: false };

assert.deepEqual(parseWastageMode({ noWaste: true }), { source: "no_waste" });
assert.throws(() => parseWastageMode({ noWaste: true, catalogueProductId: productId }), /No Waste/);
assert.throws(() => parseWastageMode({ noWaste: true, adHocItemName: "Soup" }), /No Waste/);
assert.throws(() => parseWastageMode({ noWaste: true, quantity: "1" }), /No Waste/);
assert.deepEqual(parseWastageMode({ noWaste: false, catalogueProductId: productId }), { source: "catalogue", productId });
assert.throws(() => parseWastageMode({ noWaste: false, catalogueProductId: productId, adHocItemName: "Soup" }), /exactly one/);
assert.deepEqual(parseWastageMode({ noWaste: false, adHocItemName: "  Soup  " }), { source: "adhoc", itemName: "Soup" });
assert.throws(() => parseWastageMode({ noWaste: false, adHocItemName: "   " }), /required/);
assert.deepEqual(parseWastageMode({ noWaste: false, itemId: "legacy-id" }), { source: "legacy", itemId: "legacy-id" });
assert.throws(() => requirePositiveNumberString("0"), /greater than 0/);
assert.throws(() => requirePositiveNumberString("-1"), /greater than 0/);
assert.doesNotThrow(() => requirePositiveNumberString("1.5"));

assert.equal(isUsableCatalogueProduct(validProduct), true);
assert.equal(isUsableCatalogueProduct({ ...validProduct, active: false }), false);
assert.equal(isUsableCatalogueProduct({ ...validProduct, excludedFromWastage: true }), false);
assert.doesNotThrow(() => assertCatalogueProductUsable(validProduct, "location-a"));
assert.throws(() => assertCatalogueProductUsable(validProduct, "location-b"), /does not belong/);
assert.throws(() => assertCatalogueProductUsable({ ...validProduct, active: false }, "location-a"), /inactive/);
assert.throws(() => assertCatalogueProductUsable({ ...validProduct, excludedFromWastage: true }, "location-a"), /excluded/);
assert.deepEqual(catalogueWastageSnapshot(validProduct), { catalogueProductId: productId, cataloguePlu: 1234, itemName: "TouchOffice Sandwich", categorySnapshot: "Chilled", source: "catalogue" });

const exportRows = buildWastageExportRows([
  { itemName: "TouchOffice Sandwich", quantity: "2", noWaste: false, createdAt: new Date("2026-10-01T12:00:00Z") },
  { itemName: "Ad-hoc Soup", quantity: "1", noWaste: false, createdAt: new Date("2026-10-01T12:00:00Z") },
  { itemName: "Legacy Item", quantity: "3", noWaste: false, createdAt: new Date("2026-10-01T12:00:00Z") },
], { name: "Blackpool North", shortName: "Blackpool", timezone: "Europe/London" });
assert.deepEqual(exportRows.map(row => row["Food Type"]), ["Ad-hoc Soup", "Legacy Item", "TouchOffice Sandwich"]);
assert.deepEqual(exportRows.map(row => row.Quantity), [1, 3, 2]);

const schema = fs.readFileSync(new URL("../src/server/db/schema.ts", import.meta.url), "utf8");
const catalogueService = fs.readFileSync(new URL("../src/server/catalogue/service.ts", import.meta.url), "utf8");
const complianceService = fs.readFileSync(new URL("../src/server/compliance/service.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("../drizzle/0006_touchoffice_wastage_foundation.sql", import.meta.url), "utf8");
assert.match(schema, /excludedFromWastage/);
assert.match(schema, /wastageReviewedBy/);
assert.match(schema, /catalogueProductId/);
assert.match(schema, /categorySnapshot/);
assert.match(schema, /wastageSource/);
assert.match(catalogueService, /excludedFromWastage/);
assert.match(catalogueService, /wastageCategory/);
const syncUpdate = catalogueService.split("\n").find(line => line.includes("tx.update(catalogueProducts).set"));
assert.ok(syncUpdate);
assert.doesNotMatch(syncUpdate, /wastageCategory|excludedFromWastage|wastageReviewedAt|wastageReviewedBy/);
assert.match(complianceService, /catalogueWastageSnapshot/);
assert.match(complianceService, /assertCatalogueProductUsable/);
assert.match(migration, /ON DELETE restrict/);
assert.equal(fs.existsSync(new URL("../api/catalogue/wastage.ts", import.meta.url)), true);
assert.equal(fs.existsSync(new URL("../api/catalogue/[id].ts", import.meta.url)), true);

console.log("P2-C7A wastage modes, validation, snapshots, export and API foundation tests passed");
