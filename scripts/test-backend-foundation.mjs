import assert from "node:assert/strict";
import { checkDatabase } from "../src/server/health.ts";
import { FOUNDATION_LOCATIONS } from "../src/server/db/seed.ts";
import { foundationTables } from "../src/server/db/schema.ts";

const calls = [];
const result = await checkDatabase({
  execute(query) {
    calls.push(String(query));
    return Promise.resolve([{ ok: 1 }]);
  },
});
assert.deepEqual(result, { ok: true, database: "connected" });
assert.equal(calls.length, 1);
assert.equal(Object.keys(foundationTables).length, 34);
assert.deepEqual(FOUNDATION_LOCATIONS.map(location => location.shortName), [
  "blackpool", "bolton", "poulton", "rochdale",
]);

console.log("Backend foundation tests passed (3/3)");
