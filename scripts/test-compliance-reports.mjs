import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { asOfIssue, evaluatedDays, reportDateRange, sectionCompletion } from "../src/server/reports/calculations.ts";
import { currentMonthRange, last30DaysRange, previousMonthRange } from "../src/lib/compliance-reports.ts";

const reportService = await readFile(new URL("../src/server/reports/service.ts", import.meta.url), "utf8");
const reportRoute = await readFile(new URL("../api/reports/compliance.ts", import.meta.url), "utf8");
const reportUi = await readFile(new URL("../src/components/ComplianceReports.tsx", import.meta.url), "utf8");
const dayView = await readFile(new URL("../src/components/MobileDayView.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");

const range = reportDateRange("2026-07-01", "2026-07-03");
assert.deepEqual(range.days, ["2026-07-01", "2026-07-02", "2026-07-03"], "valid local date range accepted");
assert.throws(() => reportDateRange("2026-07-04", "2026-07-03"), /invalid/, "backwards range rejected");
assert.throws(() => reportDateRange("2026-02-30", "2026-03-01"), /YYYY-MM-DD/, "invalid calendar date rejected");
assert.throws(() => reportDateRange("2026-01-01", "2027-01-02"), /too large/, "range over 366 days rejected");
assert.match(reportRoute, /handleQuery/);
assert.match(reportService, /requireLocationManager/);
assert.match(reportService, /calendar\(context/);
assert.match(reportService, /locationId/);
assert.match(reportService, /timezone/);

const days = [
  { date: "2026-01-15", status: "green", complete: true, sections: { temperature_am: true, temperature_pm: true } },
  { date: "2026-01-16", status: "red", complete: false, sections: { temperature_am: false, temperature_pm: true }, correctiveActionRecorded: true },
  { date: "2026-01-17", status: "grey", complete: false, sections: { temperature_am: false, temperature_pm: false } },
];
assert.equal(evaluatedDays(days, "2026-01-16").length, 2, "future days excluded");
assert.equal(evaluatedDays(days, "2025-12-31").length, 0, "zero evaluated days supported");
assert.equal(sectionCompletion(days, "temperature_am", "2026-01-16").requiredDays, 2, "AM temperature denominator is evaluated days");
assert.equal(sectionCompletion(days, "temperature_am", "2026-01-16").completedDays, 1, "AM temperature completion counted");
assert.equal(sectionCompletion(days, "temperature_pm", "2026-01-16").incompleteDays, 0, "PM temperature completion counted");
assert.equal(sectionCompletion(days, "temperature_am", "2025-12-31").completionRate, null, "no fake 100 percent");
assert.equal(days[1].status, "red", "report consumes calendar status unchanged");
assert.equal(days[1].correctiveActionRecorded, true, "corrective action day retained");

for (const key of ["temperature_am", "temperature_pm", "opening_checklist", "closing_checklist", "security_am", "security_pm", "food_probes", "cleaning", "wastage", "additional_checks"]) assert.match(reportService, new RegExp(key), `${key} section exists`);
assert.match(reportService, /failed fridge reading|result === "fail"/);
assert.match(reportService, /sourceTemperatureReadingId/);
assert.match(reportService, /sourceFoodCheckId/);
assert.match(reportService, /checklist/);
assert.match(reportService, /security/);
assert.match(reportService, /wastage/);
assert.match(reportService, /additional/);
assert.match(reportService, /openAtRangeEnd/);
assert.equal(asOfIssue({ createdAt: new Date("2026-07-01T10:00:00Z"), resolvedAt: null, status: "open" }, new Date("2026-07-03T23:59:59Z")), true, "open issue counted at range end");
assert.equal(asOfIssue({ createdAt: new Date("2026-07-01T10:00:00Z"), resolvedAt: new Date("2026-07-02T10:00:00Z"), status: "resolved" }, new Date("2026-07-03T23:59:59Z")), false, "resolved issue excluded at range end");
assert.match(reportService, /documentUrl/);
assert.doesNotMatch(reportService, /documentStorageId.*return|pathname.*return/);

const winter = currentMonthRange(new Date(2026, 0, 15));
const summer = currentMonthRange(new Date(2026, 6, 15));
assert.equal(winter.start, "2026-01-01", "GMT preset keeps date key");
assert.equal(summer.start, "2026-07-01", "BST preset keeps date key");
assert.deepEqual(previousMonthRange(new Date(2026, 0, 15)), { start: "2025-12-01", end: "2025-12-31" }, "previous month preset is stable");
assert.deepEqual(last30DaysRange(new Date(2026, 6, 15)), { start: "2026-06-16", end: "2026-07-15" }, "last 30 days preset is stable");
assert.match(reportUi, /Current month/);
assert.match(reportUi, /Previous month/);
assert.match(reportUi, /Last 30 days/);
assert.match(reportUi, /type="date"/);
assert.match(reportUi, /Daily records/);
assert.match(reportUi, /Issues &amp; Actions|Issues & Actions/);
assert.match(reportUi, /Manager reviews/);
assert.match(reportUi, /role="tab"/);
assert.match(dayView, /All recorded readings/);
assert.match(dayView, /All recorded probe readings/);
assert.match(dayView, /View issue journey/);
assert.match(dayView, /summary\?\.complete \? "Complete"/);
assert.match(dayView, /Corrective action recorded/);
assert.match(reportUi, /Corrective action recorded/);
assert.doesNotMatch(reportUi, /Issue recorded/);
assert.doesNotMatch(reportUi, /<h2[^>]*>Exceptions<\/h2>/);
assert.doesNotMatch(reportUi, /<h2[^>]*>Corrective actions \/ issues<\/h2>/);
assert.match(reportUi, /onOpenDay/);
assert.match(dashboard, /setSelectedDay\(date\)/);
assert.doesNotMatch(reportUi, /documentStorageId|pathname/);
assert.match(reportUi, /No issues match this filter/);
assert.match(reportService, /evaluatedDaysMissingEvidence/);
assert.match(reportService, /No Waste|noWaste/);
assert.match(reportService, /rechecksRecorded/);
assert.match(reportService, /resolvedInRange/);
assert.match(reportService, /updatedInRange/);
assert.match(reportService, /recheckedInRange/);

console.log("Compliance report tests passed: 44/44");
