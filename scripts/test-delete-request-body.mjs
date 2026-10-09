import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseBody } from "../src/server/compliance/http.ts";

const expectInvalid = (request, allowEmpty = false) => {
  assert.throws(
    () => parseBody(request, allowEmpty),
    error => error?.status === 400 && error.message === "Invalid JSON body",
  );
};

// DELETE routes may omit a body, while the shared parser still supplies the
// object expected by the existing service callbacks.
assert.deepEqual(parseBody({ method: "DELETE" }, true), {});
expectInvalid({ method: "DELETE", body: "{" }, true);
expectInvalid({ method: "DELETE", body: "" }, true);
expectInvalid({ method: "DELETE", body: "null" }, true);

// POST/PATCH and other strict callers remain unchanged.
expectInvalid({ method: "POST" });
expectInvalid({ method: "PATCH" });
assert.deepEqual(parseBody({ method: "PATCH", body: JSON.stringify({ question: "Door locked?" }) }), { question: "Door locked?" });
expectInvalid({ method: "PATCH", body: JSON.stringify([]) });

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const securityRoute = await read("api/admin/security-questions/[id].ts");
const http = await read("src/server/compliance/http.ts");
const restDomain = await read("src/lib/rest-domain.ts");
const admin = await read("src/components/admin/AdminStoreOverview.tsx");
const securityService = await read("src/server/management/security-service.ts");

assert.match(http, /parseBody\(req, req\.method === "DELETE"\)/);
assert.match(securityRoute, /req\.method === "DELETE" \? deleteSecurity\(/);
assert.match(restDomain, /deleteSecurityQuestion:.*remove\(/);
assert.match(admin, /const deleteSecurity = useRestMutation\(/);
assert.match(admin, /await deleteSecurity\(\{ questionId: item\._id \}\)/);
assert.match(securityService, /active: false, deactivatedAt/);
assert.match(securityService, /centralItemId && context\.user\.role !== "admin"/);

// Every shared-handler DELETE endpoint receives the same bodyless-request
// behaviour; each branch passes its route id to an existing service.
const deleteRoutes = [
  "api/team-members/memberships/[id].ts",
  "api/team-members/[id].ts",
  "api/admin/probe-products/[id].ts",
  "api/admin/training-requirements/[id].ts",
  "api/admin/checklist-questions/[id].ts",
  "api/admin/cleaning-tasks/[id].ts",
  "api/admin/security-questions/[id].ts",
  "api/admin/wastage-items/[id].ts",
  "api/admin/additional-requirements/[id].ts",
];
for (const route of deleteRoutes) {
  const source = await read(route);
  assert.match(source, /handleWrite/);
  assert.match(source, /"DELETE"/);
}

console.log("DELETE body handling tests passed: bodyless deletes, strict JSON validation, ownership safeguards and refresh wiring");
