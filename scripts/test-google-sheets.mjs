import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildWastageExportRows,
  validateWastageRows,
} from "../src/server/wastage/pure.ts";
import { syncWastageRowsWithClient } from "../src/server/wastage/google.ts";
import {
  buildGoogleExternalAccountOptions,
  buildGoogleWorkloadIdentityAudience,
  getGoogleSheetsAuth,
} from "../src/server/wastage/google-auth.ts";

process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-id";
process.env.GOOGLE_SHEETS_TAB_NAME = "Wastage";
process.env.GCP_PROJECT_ID = "le-feast-test";
process.env.GCP_PROJECT_NUMBER = "123456789";
process.env.GCP_SERVICE_ACCOUNT_EMAIL = "le-feast-compliance-sheets@le-feast-test.iam.gserviceaccount.com";
process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = "vercel-le-feast";
process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = "le-feast-compliance";
delete process.env.GOOGLE_SHEETS_CONNECTOR_ID;
delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;

const config = {
  projectId: "le-feast-test",
  projectNumber: "123456789",
  serviceAccountEmail: "le-feast-compliance-sheets@le-feast-test.iam.gserviceaccount.com",
  poolId: "vercel-le-feast",
  providerId: "le-feast-compliance",
};
const audience = buildGoogleWorkloadIdentityAudience(config);
assert.equal(audience, "https://iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/vercel-le-feast/providers/le-feast-compliance");
let tokenRequest;
let authOptions;
const fakeAuth = {};
const auth = await getGoogleSheetsAuth({
  tokenGetter: async (options) => { tokenRequest = options; return "vercel-oidc-test-token"; },
  authFactory: (options) => { authOptions = options; return fakeAuth; },
});
assert.equal(auth, fakeAuth);
assert.equal(authOptions.type, "external_account");
assert.equal(authOptions.audience, audience);
assert.equal(authOptions.subject_token_type, "urn:ietf:params:oauth:token-type:jwt");
assert.equal(authOptions.token_url, "https://sts.googleapis.com/v1/token");
assert.equal(authOptions.service_account_impersonation_url, "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/le-feast-compliance-sheets@le-feast-test.iam.gserviceaccount.com:generateAccessToken");
assert.deepEqual(authOptions.scopes, ["https://www.googleapis.com/auth/spreadsheets"]);
assert.equal(await authOptions.subject_token_supplier.getSubjectToken({ audience }), "vercel-oidc-test-token");
assert.deepEqual(tokenRequest, { audience });
assert.deepEqual(buildGoogleExternalAccountOptions(config).type, "external_account");
await assert.rejects(
  () => buildGoogleExternalAccountOptions(config, async () => { throw new Error("opaque-token-value"); }).subject_token_supplier.getSubjectToken({ audience }),
  /Vercel OIDC token exchange failed/,
);
const authSource = await readFile(new URL("../src/server/wastage/google-auth.ts", import.meta.url), "utf8");
assert.ok(!authSource.includes("@vercel/connect"));
assert.ok(!authSource.includes("GoogleAuth({"));
assert.ok(!authSource.includes("console.log"));

const location = {
  name: "Blackpool North",
  shortName: "Blackpool",
  timezone: "Europe/London",
};

const records = [
  { createdAt: Date.parse("2026-09-01T10:00:00Z"), itemName: "Chicken", quantity: "2", noWaste: false },
  { createdAt: Date.parse("2026-09-01T12:00:00Z"), itemName: "Reduced Chicken", quantity: "3", noWaste: false },
  { createdAt: Date.parse("2026-09-01T13:00:00Z"), itemName: "No Waste", quantity: "99", noWaste: false },
  { createdAt: Date.parse("2026-09-01T14:00:00Z"), itemName: "Sausage", quantity: "0", noWaste: false },
  { createdAt: Date.parse("2026-09-01T15:00:00Z"), itemName: "Chicken", quantity: "4", noWaste: true },
];

const rows = buildWastageExportRows(records, location);
assert.deepEqual(rows, [
  { Store: "Blackpool", Date: "01/09/2026", "Food Type": "Chicken", Quantity: 5 },
]);

assert.throws(
  () => validateWastageRows([{ Store: "Blackpool", Date: "01/09/2026", "Food Type": "Chicken", Quantity: 0 }]),
  /invalid/,
);
assert.throws(
  () => validateWastageRows([rows[0], rows[0]]),
  /Duplicate wastage export row/,
);

let values = [
  ["Store", "Date", "Food Type", "Quantity"],
  ["Other store", "31/08/2026", "Historic item", 7],
  ["Blackpool", "01/09/2026", "Chicken", 1],
];
let batchUpdateCalls = 0;
const sheets = {
  spreadsheets: {
    values: {
      async get() {
        return { data: { values } };
      },
      async batchUpdate({ requestBody }) {
        batchUpdateCalls += 1;
        for (const update of requestBody.data) {
          const match = update.range.match(/!([A-Z]+)(\d+)(?::[A-Z]+(\d+))?$/);
          assert.ok(match, `unexpected range ${update.range}`);
          const start = Number(match[2]);
          if (match[1] === "D") {
            for (const [offset, row] of update.values.entries()) {
              values[start - 1 + offset][3] = row[0];
            }
          } else {
            for (const [offset, row] of update.values.entries()) {
              values[start - 1 + offset] = row;
            }
          }
        }
      },
    },
  },
};

const first = await syncWastageRowsWithClient(sheets, "sheet-id", "Wastage", rows);
assert.deepEqual(first, { updated: 1, appended: 0, unchanged: 0 });
assert.equal(values[2][3], 5);
assert.deepEqual(values[1], ["Other store", "31/08/2026", "Historic item", 7]);

const second = await syncWastageRowsWithClient(sheets, "sheet-id", "Wastage", rows);
assert.deepEqual(second, { updated: 0, appended: 0, unchanged: 1 });
assert.equal(batchUpdateCalls, 1);

values = [["Store", "Date", "Food Type", "Quantity"]];
const appended = await syncWastageRowsWithClient(sheets, "sheet-id", "Wastage", rows);
assert.deepEqual(appended, { updated: 0, appended: 1, unchanged: 0 });
assert.deepEqual(values[1], ["Blackpool", "01/09/2026", "Chicken", 5]);

console.log("Google Sheets wastage sync tests passed");
