import assert from "node:assert/strict";
import {
  buildWastageExportRows,
  validateWastageRows,
} from "../src/server/wastage/pure.ts";
import { syncWastageRowsWithClient } from "../src/server/wastage/google.ts";
import { getGoogleSheetsAuth } from "../src/server/wastage/google-auth.ts";

process.env.GOOGLE_SHEETS_SPREADSHEET_ID = "sheet-id";
process.env.GOOGLE_SHEETS_TAB_NAME = "Wastage";
process.env.GOOGLE_SHEETS_CONNECTOR_ID = "google/test-connector";
delete process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;

let tokenRequest;
let credentials;
const fakeAuth = { setCredentials(value) { credentials = value; } };
const auth = await getGoogleSheetsAuth({
  tokenGetter: async (connector, params) => { tokenRequest = { connector, params }; return "short-lived-test-token"; },
  authFactory: () => fakeAuth,
});
assert.equal(auth, fakeAuth);
assert.deepEqual(tokenRequest, { connector: "google/test-connector", params: { subject: { type: "app" } } });
assert.deepEqual(credentials, { access_token: "short-lived-test-token" });

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
