import assert from "node:assert/strict";
import {
  buildCatalogueChanges,
  assertCatalogueSize,
  MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE,
  mapCatalogueToLocations,
  normalizeCataloguePayload,
} from "../src/convex/catalogueSync.ts";

const locations = [
  { _id: "blackpool-id", name: "Blackpool", shortName: "Blackpool" },
  { _id: "poulton-id", name: "Poulton", shortName: "Poulton" },
  { _id: "rochdale-id", name: "Rochdale", shortName: "Rochdale" },
  { _id: "bolton-id", name: "Bolton", shortName: "Bolton" },
];

const rawProducts = ["1", "2", "3", "4"].map(storeId => ({
  storeId,
  plu: 100,
  name: `Product ${storeId}`,
  department: "Food",
  group: "Fresh",
  valueSources: { name: "head_office", department: "head_office", group: "head_office" },
}));

const payload = normalizeCataloguePayload({
  ok: true,
  retrievedAt: "2026-09-25T12:00:00.000Z",
  products: rawProducts,
});

const mapped = mapCatalogueToLocations(payload.products, locations);
assert.equal(mapped.find(product => product.siteId === "1").locationId, "blackpool-id");
assert.equal(mapped.find(product => product.siteId === "2").locationId, "poulton-id");
assert.equal(mapped.find(product => product.siteId === "3").locationId, "rochdale-id");
assert.equal(mapped.find(product => product.siteId === "4").locationId, "bolton-id");

const blackpoolProducts = mapped.filter(product => product.locationId === "blackpool-id");
const firstSync = buildCatalogueChanges([], blackpoolProducts, 1000);
assert.equal(firstSync.summary.added, 1);
assert.equal(firstSync.summary.removed, 0);
assert.ok(firstSync.upserts.every(product => product.needsCategoryReview));

const repeatedSync = buildCatalogueChanges(
  firstSync.upserts.map((product, index) => ({
    ...product,
    _id: `id-${index}`,
  })),
  blackpoolProducts,
  2000,
);
assert.deepEqual(repeatedSync.summary, { added: 0, renamed: 0, removed: 0, count: 1 });
assert.ok(repeatedSync.upserts.every(product => product.lastSuccessfulSyncAt === 2000));

const newProduct = { ...mapped[0], plu: 101, name: "New Product" };
const changed = buildCatalogueChanges(
  firstSync.upserts.map((product, index) => ({ ...product, _id: `id-${index}` })),
  [...blackpoolProducts, newProduct],
  3000,
);
assert.equal(changed.summary.added, 1);
assert.ok(changed.upserts.find(product => product.plu === 101).needsCategoryReview);

const removed = buildCatalogueChanges(
  firstSync.upserts.map((product, index) => ({ ...product, _id: `id-${index}` })),
  [],
  4000,
);
assert.equal(removed.summary.removed, 1);

const lastGoodCatalogue = firstSync.upserts.map((product, index) => ({
  ...product,
  _id: `id-${index}`,
}));
const lastGoodSnapshot = structuredClone(lastGoodCatalogue);
assert.throws(
  () => assertCatalogueSize(lastGoodCatalogue, []),
  /unexpectedly small/,
);
assert.deepEqual(lastGoodCatalogue, lastGoodSnapshot);

assert.equal(MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE, 200);
assert.doesNotThrow(() =>
  assertCatalogueSize(
    [],
    Array.from({ length: MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE }, () => ({})),
  ),
);
assert.throws(
  () => assertCatalogueSize([], Array.from({ length: 199 }, () => ({}))),
  /unexpectedly small/,
);
assert.doesNotThrow(() =>
  assertCatalogueSize(
    Array.from({ length: 239 }, () => ({ active: true })),
    Array.from({ length: 120 }, () => ({})),
  ),
);
assert.throws(
  () => assertCatalogueSize(
    Array.from({ length: 239 }, () => ({ active: true })),
    Array.from({ length: 119 }, () => ({})),
  ),
  /unexpectedly small/,
);

assert.throws(
  () => normalizeCataloguePayload({ ok: true, retrievedAt: "now", products: rawProducts.slice(0, 3) }),
  /missing store 4/,
);

assert.throws(
  () => mapCatalogueToLocations(payload.products, locations.filter(location => location.name !== "Bolton")),
  /could not be mapped/,
);

console.log("Catalogue sync mapping, repeat, new-product and failure tests passed");
