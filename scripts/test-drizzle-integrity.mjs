import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile("src/server/db/schema.ts", "utf8");
const foundation = await readFile("drizzle/0000_foundation.sql", "utf8");
const authMigration = await readFile("drizzle/0002_auth_foundation.sql", "utf8");

for (const relationship of [
  "locations.id",
  "users.id",
  "memberships",
  "teamMembers",
  "temperatureRounds",
  "temperatureReadings",
  "issueUpdates",
  "trainingDocumentVersions",
]) {
  assert.match(schema, new RegExp(relationship.replace(/[.]/g, "\\.")), `Missing schema relationship marker: ${relationship}`);
}
assert.match(schema, /trainingRequirementsRelations/);
assert.match(schema, /currentDocumentVersion/);
assert.match(schema, /requiredDocumentVersion/);
assert.match(schema, /foreignKey\(/);
assert.match(foundation, /FOREIGN KEY/);
assert.equal(/ON DELETE CASCADE/i.test(foundation), false);
assert.equal(/DROP CONSTRAINT/i.test(authMigration), false);
assert.equal(/ADD CONSTRAINT "auth_sessions_user_id_users_id_fk"/.test(authMigration), true);
console.log("Drizzle integrity checks passed");
