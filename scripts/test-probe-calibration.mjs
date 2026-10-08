import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { additionalCheckHasFailure, additionalFieldFailed } from "../src/shared/additional-check-validation.ts";

const red = { key: "red", label: "Red probe", type: "temperature", minimum: 74, maximum: 76 };
const black = { key: "black", label: "Black probe", type: "temperature", minimum: 74, maximum: 76 };
assert.equal(additionalFieldFailed(red, "75.0"), false, "in-range red probe does not fail");
assert.equal(additionalFieldFailed(black, "78.0"), true, "out-of-range black probe fails");
assert.equal(additionalCheckHasFailure([red, black], { red: "75", black: "78" }), true);
assert.equal(additionalCheckHasFailure([red, black], { red: "75", black: "76" }), false);

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const [service, view, admin, history] = await Promise.all([
  read("src/server/additional/service.ts"),
  read("src/components/AdditionalChecksView.tsx"),
  read("src/components/AdditionalAdmin.tsx"),
  read("src/server/history/chronology.ts"),
]);
assert.match(service, /additionalFieldFailed/);
assert.match(service, /correctiveNote/);
assert.match(service, /Corrective action is required for a failed additional check/);
assert.match(view, /Corrective Action Taken/);
assert.match(view, /Acceptable range/);
assert.match(view, /hasFailedValue/);
assert.match(admin, /Acceptable minimum/);
assert.match(admin, /Corrective action options/);
assert.match(history, /Corrective action taken:/);
console.log("Probe calibration tests passed: numeric Red/Black ranges, conditional action evidence and historical compatibility");
