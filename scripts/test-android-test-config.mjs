import assert from "node:assert/strict";

const origin = process.env.EHO_ANDROID_TEST_ORIGIN ?? "https://eho-test.lefeast.co.uk";
const database = process.env.EHO_ANDROID_TEST_DATABASE_URL ?? "";
const storage = process.env.EHO_ANDROID_TEST_STORAGE_ORIGIN ?? "";

assert.equal(origin, "https://eho-test.lefeast.co.uk", "Android test origin must be the isolated HTTPS hostname");
assert.ok(!origin.includes("eho.lefeast.co.uk"), "Android test origin must not be the live EHO hostname");
if (database) {
  assert.ok(!/production|prod|main/i.test(database), "Android test database must not identify a production/main target");
  assert.ok(/test|preview|branch|localhost|127\.0\.0\.1/i.test(database), "Android test database URL must identify an isolated target");
}
if (storage) assert.ok(!/eho\.lefeast\.co\.uk|production|prod/i.test(storage), "Android test storage must not be live storage");
console.log(JSON.stringify({ ok: true, origin, databaseConfigured: Boolean(database), storageConfigured: Boolean(storage), signingKey: "not generated" }));
