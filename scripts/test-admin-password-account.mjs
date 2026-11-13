import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPasswordCredential, verifyPassword } from "../src/server/auth/core.ts";

const password = "fictional-admin-created-password";
const credential = createPasswordCredential(password);
assert.notEqual(credential.hash, password);
assert.notEqual(credential.salt, password);
assert.equal(verifyPassword(password, { passwordHash: credential.hash, passwordSalt: credential.salt }), true);
assert.equal(verifyPassword("wrong fictional password", { passwordHash: credential.hash, passwordSalt: credential.salt }), false);

const [service, route, ui] = await Promise.all([
  readFile(new URL("../src/server/management/user-access-service.ts", import.meta.url), "utf8"),
  readFile(new URL("../api/admin/user-access/create.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/UserAccessAdmin.tsx", import.meta.url), "utf8"),
]);
const createFlow = service.slice(service.indexOf("export async function createUserWithPassword"), service.indexOf("export async function updateUserAccess"));
assert.match(createFlow, /organisationIdFor\(context\)/, "organization administrator permission is enforced server-side");
assert.match(createFlow, /createPasswordCredential\(input\.password\)/);
assert.match(createFlow, /db\(\)\.transaction/);
assert.match(createFlow, /users\.normalizedEmail/);
assert.match(createFlow, /user_access_created_with_password/);
assert.doesNotMatch(createFlow, /sendInvite|sendInvitationEmail|console\.(log|error).*password/i, "direct creation neither emails nor logs a password");
assert.match(route, /handleMutation\(req, res, createUserWithPassword\)/, "route requires authenticated mutation context and origin validation");
assert.match(ui, /Create account/);
assert.match(ui, /autoComplete="new-password"/);
console.log("PASS: fictional direct account password is hashed, organization-admin protected, transactional, and sends no invitation");
