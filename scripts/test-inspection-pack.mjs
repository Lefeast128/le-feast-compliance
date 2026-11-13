import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFile } from "node:fs/promises";
import { afterUseCleaningStatus } from "../src/shared/cleaning-scheduling.ts";
import { renderComplianceCsv } from "../src/server/reports/export.ts";
import { reportDateRange } from "../src/server/reports/calculations.ts";
import { buildInspectionPack } from "../src/server/reports/inspection-pack.ts";

const service = await readFile(new URL("../src/server/reports/inspection-pack.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../api/reports/compliance/inspection-pack.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/ComplianceReports.tsx", import.meta.url), "utf8");
const history = await readFile(new URL("../src/server/history/service.ts", import.meta.url), "utf8");

assert.equal(afterUseCleaningStatus(false, 0), "not_required", "no after-use task is not scheduled");
assert.equal(afterUseCleaningStatus(true, 0), "not_verifiable", "after-use usage is not verifiable without a usage event");
assert.equal(afterUseCleaningStatus(true, 1), "recorded", "a genuine after-use completion is reported as recorded");
assert.match(service, /loadReport\(context/);
assert.match(service, /loadArchive\(context/);
assert.doesNotMatch(service, /range\.days\.map\(date => archive/);
assert.match(service, /chronology/);
assert.match(route, /handleQuery/);
assert.match(route, /inspectionPack\(context/);
assert.match(ui, /Generate Inspection Pack/);
assert.match(ui, /Print \/ Save PDF/);
assert.match(ui, /Evidence chronology/);
assert.match(ui, /Missing or unverifiable evidence/);
assert.match(ui, /Opening \/ Closing checks/);
assert.match(ui, /Wastage records/);
assert.match(ui, /inspectionPackRequest/);
assert.match(ui, /inspection-print-root/);
assert.match(ui, /inspection-pack-section/);
assert.match(history, /afterUseCleaningStatus/);

const rangeFixtures = [
  ["2026-10-05", "2026-10-05", 1],
  ["2026-10-05", "2026-10-11", 7],
  ["2026-10-01", "2026-10-30", 30],
  ["2026-10-01", "2026-12-29", 90],
];
for (const [start, end, expectedDays] of rangeFixtures) {
  const archiveCalls = [];
  const started = performance.now();
  const fixture = await buildInspectionPack({}, { locationId: "store-1", start, end }, {
    loadReport: async (_context, input) => ({ location: { id: input.locationId }, range: { start: input.start, end: input.end }, days: [] }),
    loadArchive: async (_context, input) => {
      archiveCalls.push(input);
      return { chronology: [{ id: "later", occurredAt: "2026-10-02T10:00:00.000Z" }, { id: "earlier", occurredAt: "2026-10-01T10:00:00.000Z" }] };
    },
  });
  const elapsed = performance.now() - started;
  assert.equal(archiveCalls.length, 1, `${expectedDays}-day pack uses one bounded history load`);
  assert.deepEqual(archiveCalls[0], { locationId: "store-1", start, end }, "history load uses the exact selected range");
  assert.equal(fixture.chronology.length, 2, "pack keeps chronology from the range history load");
  assert.equal(fixture.chronology[0].id, "earlier", "pack chronology remains ordered across the selected range");
  assert.ok(elapsed < 1000, `${expectedDays}-day fixture generation remains bounded`);
}

const csv = renderComplianceCsv({
  location: { name: "Store", timezone: "Europe/London" },
  range: { start: "2026-10-05", end: "2026-10-07", timezone: "Europe/London" },
  summary: { daysEvaluated: 3, completeDays: 2, incompleteDays: 1, correctiveActionDays: 1, daysWithTemperatureFailure: 1, daysWithProbeFailure: 0, completionRate: 2 / 3 },
  sections: {},
  days: [
    { date: "2026-10-05", status: "green", complete: true, cleaningStatus: "complete", afterUseCleaningStatus: "not_required", sections: {}, counts: {} },
    { date: "2026-10-06", status: "green", complete: true, cleaningStatus: "recorded", afterUseCleaningStatus: "recorded", sections: {}, counts: {} },
    { date: "2026-10-07", status: "green", complete: true, cleaningStatus: "not_verifiable", afterUseCleaningStatus: "not_verifiable", sections: {}, counts: {} },
  ],
  exceptions: [],
  issues: { openAtRangeEnd: 0, rows: [] },
  additional: { rows: [] },
}, "2026-10-08T12:00:00.000Z").toString("utf8");
assert.match(csv, /Cleaning required and completed/);
assert.match(csv, /Cleaning recorded/);
assert.match(csv, /Usage requirement: Not verifiable/);
assert.deepEqual(reportDateRange("2026-10-05", "2026-10-07").days, ["2026-10-05", "2026-10-06", "2026-10-07"], "pack date boundaries remain inclusive");

console.log("Inspection Evidence Pack tests passed: read-only composition, cleaning evidence and printable UI");
