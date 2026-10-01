import assert from "node:assert/strict";
import { assertCatalogueSize, buildCatalogueChanges, mapCatalogueToLocations, MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE, normalizeCataloguePayload } from "../src/server/catalogue/pure.ts";
import { buildWastageExportRows, validateWastageRows } from "../src/server/wastage/pure.ts";
import { cronAuthorized } from "../src/server/jobs/auth.ts";
import fs from "node:fs";

const stores = [
  { id: "1", name: "Blackpool North", shortName: "Blackpool" },
  { id: "2", name: "Poulton-le-Fylde", shortName: "Poulton" },
  { id: "3", name: "Rochdale", shortName: "Rochdale" },
  { id: "4", name: "Bolton", shortName: "Bolton" },
];
const product = storeId => ({ storeId, plu: 222, name: `Product ${storeId}`, valueSources: { name: "store", department: "missing", group: "missing" } });
const payload = normalizeCataloguePayload({ ok: true, retrievedAt: "2026-10-01T12:00:00Z", products: stores.map(store => product(store.id)) });
const mapped = mapCatalogueToLocations(payload.products, stores.map(store => ({ id: store.id, name: store.name, shortName: store.shortName })));
assert.deepEqual(mapped.map(item => item.locationId), ["1", "2", "3", "4"]);
assert.throws(() => normalizeCataloguePayload({ ok: true, retrievedAt: "now", products: [product("1"), product("1")] }), /Duplicate/);
assert.throws(() => normalizeCataloguePayload({ ok: true, retrievedAt: "now", products: [product("1"), product("2"), product("3")] }), /missing store 4/);
assert.throws(() => mapCatalogueToLocations(payload.products, stores.concat({ id: "5", name: "Blackpool East", shortName: "Blackpool" })), /could not be mapped/);
assert.equal(MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE, 200);
assert.throws(() => assertCatalogueSize([], Array.from({ length: 199 }, () => ({}))), /unexpectedly small/);
assert.doesNotThrow(() => assertCatalogueSize([], Array.from({ length: 200 }, () => ({}))));
assert.throws(() => assertCatalogueSize(Array.from({ length: 239 }, () => ({ active: true })), Array.from({ length: 119 }, () => ({}))), /unexpectedly small/);
const syncedAt = new Date("2026-10-01T12:00:00Z");
const changes = buildCatalogueChanges([{ id: "old", plu: 222, name: "Old", active: true, needsCategoryReview: false, firstSeenAt: syncedAt }], [{ ...mapped[0], name: "Renamed" }], syncedAt);
assert.equal(changes.summary.renamed, 1);
assert.equal(changes.summary.removed, 0);
assert.equal(changes.upserts[0].needsCategoryReview, true);
const removed = buildCatalogueChanges([{ id: "old", plu: 222, name: "Old", active: true, needsCategoryReview: false, firstSeenAt: syncedAt }], [], syncedAt);
assert.equal(removed.summary.removed, 1);
const records = [
  { itemName: "Reduced Sandwich", quantity: "2", noWaste: false, createdAt: new Date("2026-10-01T23:30:00Z") },
  { itemName: "Sandwich", quantity: "3", noWaste: false, createdAt: new Date("2026-10-02T00:30:00Z") },
  { itemName: "No Waste", quantity: "1", noWaste: true, createdAt: new Date("2026-10-01T12:00:00Z") },
  { itemName: "Soup", quantity: "0", noWaste: false, createdAt: new Date("2026-10-01T12:00:00Z") },
];
const rows = buildWastageExportRows(records, { name: "Blackpool North", shortName: "Blackpool", timezone: "Europe/London" });
assert.deepEqual(rows, [{ Store: "Blackpool", Date: "02/10/2026", "Food Type": "Sandwich", Quantity: 5 }]);
assert.throws(() => validateWastageRows([{ ...rows[0] }, { ...rows[0] }]), /Duplicate/);
assert.throws(() => validateWastageRows([{ ...rows[0], Quantity: 0 }]), /invalid/);
process.env.CRON_SECRET = "test-cron-secret";
assert.equal(cronAuthorized({ authorization: "Bearer test-cron-secret" }), true);
assert.equal(cronAuthorized({ authorization: "Bearer wrong" }), false);
assert.equal(cronAuthorized({ cookie: "lf_session=ignored" }), false);
for (const file of ["api/catalogue.ts", "api/catalogue/refresh.ts", "api/cron/catalogue-sync.ts", "api/cron/wastage-sync.ts"]) assert.equal(fs.existsSync(new URL(`../${file}`, import.meta.url)), true);
assert.match(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"), /0 \* \* \* \*/);
console.log("Phase 7 catalogue, wastage export, cron security and schedule tests passed");
