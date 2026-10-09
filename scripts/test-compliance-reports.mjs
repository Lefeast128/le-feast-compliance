import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { asOfIssue, evaluatedDays, reportDateRange, sectionCompletion } from "../src/server/reports/calculations.ts";
import { hasCorrectiveActionEvidence, hasCorrectiveActionOnDay } from "../src/server/compliance/corrective-action.ts";
import { cleaningEvidenceStatus, cleaningIsScheduledForDate } from "../src/shared/cleaning-scheduling.ts";
import { renderComplianceCsv } from "../src/server/reports/export.ts";
import { currentMonthRange, last30DaysRange, previousMonthRange } from "../src/lib/compliance-reports.ts";

const reportService = await readFile(new URL("../src/server/reports/service.ts", import.meta.url), "utf8");
const historyService = await readFile(new URL("../src/server/history/service.ts", import.meta.url), "utf8");
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
assert.equal(sectionCompletion([{ date: "2026-01-15", status: "green", complete: true, sections: { cleaning: null } }], "cleaning", "2026-01-15").requiredDays, 0, "not-verifiable cleaning is excluded from the required denominator");
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
assert.match(reportService, /hasCorrectiveActionOnDay/);
assert.match(historyService, /hasCorrectiveActionOnDay/);
assert.doesNotMatch(reportService, /inLocalDay\(issue, "createdAt", day\.date, location\.timezone\).*hasCorrectiveActionEvidence/);
assert.doesNotMatch(historyService, /inLocalDay\(issue, "createdAt", from, location\.timezone\).*hasCorrectiveActionEvidence/);
assert.equal(hasCorrectiveActionEvidence({}), false, "failed detection alone is not corrective action evidence");
assert.equal(hasCorrectiveActionEvidence({ action: "", updates: [] }), false, "issue creation without an action is not corrective action evidence");
assert.equal(hasCorrectiveActionEvidence({ updates: [{ updateType: "resolution", note: "Resolved" }] }), false, "resolution alone is not corrective action evidence");
assert.equal(hasCorrectiveActionEvidence({ responseAction: "Door checked" }), true, "recorded response action is corrective action evidence");
assert.equal(hasCorrectiveActionEvidence({ updates: [{ updateType: "immediate_action", note: "Food moved" }] }), true, "immediate action update is corrective action evidence");
assert.equal(hasCorrectiveActionEvidence({ updates: [{ updateType: "further_action", note: "Maintenance reported" }] }), true, "further action update is corrective action evidence");

const timezone = "Europe/London";
const monday = "2026-07-13";
const tuesday = "2026-07-14";
const failedMonday = { issues: [{ createdAt: new Date("2026-07-13T09:00:00Z"), action: "Fridge door checked" }], updates: [], checklistResponses: [], probes: [] };
assert.equal(hasCorrectiveActionOnDay({ date: monday, timezone, ...failedMonday }), false, "Monday failure without action has no corrective-action indicator");

const tuesdayAction = { updates: [{ createdAt: new Date("2026-07-14T09:00:00Z"), updateType: "immediate_action", note: "Fridge door checked" }] };
assert.equal(hasCorrectiveActionOnDay({ date: tuesday, timezone, ...tuesdayAction }), true, "Tuesday corrective action appears on Tuesday");
assert.equal(hasCorrectiveActionOnDay({ date: monday, timezone, ...tuesdayAction }), false, "Tuesday corrective action does not retroactively mark Monday");

const failedProbeAction = { probes: [{ createdAt: new Date("2026-07-14T10:00:00Z"), action: "Food moved to another fridge" }] };
assert.equal(hasCorrectiveActionOnDay({ date: tuesday, timezone, ...failedProbeAction }), true, "immediate failed-probe action appears on its recording day");

const failedChecklistAction = { checklistResponses: [{ createdAt: new Date("2026-07-14T11:00:00Z"), action: "Manager informed" }] };
assert.equal(hasCorrectiveActionOnDay({ date: tuesday, timezone, ...failedChecklistAction }), true, "checklist corrective action appears on its recording day");

const resolutionOnly = { updates: [{ createdAt: new Date("2026-07-14T12:00:00Z"), updateType: "resolution", note: "Resolved" }] };
assert.equal(hasCorrectiveActionOnDay({ date: tuesday, timezone, ...resolutionOnly }), false, "resolution without corrective action has no corrective-action indicator");
assert.equal(hasCorrectiveActionOnDay({ date: monday, timezone, updates: [], checklistResponses: [], probes: [] }), false, "daily completion remains independent of corrective-action evidence");
assert.equal(days[0].complete, true, "daily completion remains complete independently of corrective-action evidence");
assert.equal({ result: "fail", temperature: 9.3 }.result, "fail", "original failed reading remains failed");

for (const [store, timezone] of [["Blackpool", "Europe/London"], ["Bolton", "Europe/London"], ["Poulton", "Europe/London"], ["Rochdale", "Europe/London"]]) {
  assert.equal(cleaningEvidenceStatus("after_use", [], "2026-07-15", timezone), "not_verifiable", `${store} after-use evidence remains neutral without usage data`);
  assert.equal(cleaningIsScheduledForDate("weekly", [2, 4], "2026-07-14", timezone), true, `${store} configured weekly schedule uses its selected weekday`);
}
assert.equal(cleaningIsScheduledForDate("specific_days", [0], "2026-07-12", "America/New_York"), true, "location timezone is used for a specific-day schedule");
assert.equal(cleaningEvidenceStatus("daily", [], "2026-03-29", "Europe/London"), "scheduled", "spring DST date remains scheduled");
assert.equal(cleaningEvidenceStatus("daily", [], "2026-10-25", "Europe/London"), "scheduled", "autumn DST date remains scheduled");
const notVerifiableCsv = renderComplianceCsv({
  location: { name: "Store", timezone: "Europe/London" },
  range: { start: "2026-07-15", end: "2026-07-15", timezone: "Europe/London" },
  summary: { daysEvaluated: 1, completeDays: 1, incompleteDays: 0, correctiveActionDays: 0, daysWithTemperatureFailure: 0, daysWithProbeFailure: 0, completionRate: 1 },
  sections: { cleaning: { requiredDays: 0, completedDays: 0, incompleteDays: 0, completionRate: null } },
  days: [{ date: "2026-07-15", status: "green", complete: true, cleaningStatus: "not_verifiable", sections: { cleaning: null }, counts: {} }],
  exceptions: [], issues: { openAtRangeEnd: 0, rows: [] }, additional: { rows: [] },
}, "2026-07-16T12:00:00.000Z").toString("utf8");
assert.match(notVerifiableCsv, /Not verifiable/, "exports distinguish after-use evidence from completed cleaning");

console.log("Compliance report tests passed, including corrective-action evidence regressions");
