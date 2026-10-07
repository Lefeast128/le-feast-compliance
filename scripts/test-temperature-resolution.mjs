import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { buildInspectionChronology } from "../src/server/history/chronology.ts";
import { correctiveActionLabel, issueStatusLabel, resultLabel } from "../src/lib/temperature-resolution.ts";
import { renderComplianceCsv, renderComplianceWorkbook } from "../src/server/reports/export.ts";

let passed = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  passed += 1;
};

check(resultLabel("fail") === "Failed", "failed result stays Failed");
check(resultLabel("pass") === "Passed", "passing recheck is displayed separately");
check(issueStatusLabel("resolved") === "Resolved", "resolved issue status is distinct");
check(correctiveActionLabel({ issueStatus: "resolved", hasAction: true, latestRecheckResult: "pass" }) === "Issue resolved", "resolved action state is distinct from reading result");
check(correctiveActionLabel({ issueStatus: "monitoring", hasAction: true }) === "Corrective action recorded", "action state is retained while issue is open");
check(correctiveActionLabel({ issueStatus: "monitoring", hasAction: true, latestRecheckResult: "fail" }) === "Recheck failed", "failed recheck is separate from original failure");

const chronology = buildInspectionChronology({
  dayStart: new Date("2026-07-15T00:00:00.000Z"),
  dayEnd: new Date("2026-07-15T23:59:59.999Z"),
  rounds: [{ id: "round-1", session: "AM", startedAt: "2026-07-15T08:00:00.000Z", completedAt: "2026-07-15T08:20:00.000Z" }],
  readings: [
    { id: "reading-1", roundId: "round-1", equipmentName: "Fridge 1", temperature: 9.1, result: "fail", createdAt: "2026-07-15T08:04:00.000Z", teamMemberId: "member-a", teamMemberName: "Alex" },
    { id: "reading-2", roundId: "round-1", equipmentName: "Fridge 2", temperature: 9.2, result: "fail", createdAt: "2026-07-15T08:05:00.000Z", teamMemberId: "member-a", teamMemberName: "Alex" },
  ],
  issues: [
    { id: "issue-1", sourceTemperatureReadingId: "reading-1", title: "Fridge 1 requires action", description: "Recorded at 9.1°C", status: "resolved", createdAt: "2026-07-15T08:04:00.000Z", resolvedAt: "2026-07-15T08:12:00.000Z", resolutionNote: "Rechecked within limit" },
    { id: "issue-2", sourceTemperatureReadingId: "reading-2", title: "Fridge 2 requires action", description: "Recorded at 9.2°C", status: "monitoring", createdAt: "2026-07-15T08:05:00.000Z" },
  ],
  issueUpdates: [
    { id: "update-1", issueId: "issue-1", updateType: "immediate_action", note: "Move food and investigate", status: "monitoring", createdAt: "2026-07-15T08:06:00.000Z", teamMemberId: "member-b", teamMemberName: "Blair" },
    { id: "update-2", issueId: "issue-1", updateType: "resolution", note: "Rechecked within limit", status: "resolved", createdAt: "2026-07-15T08:12:00.000Z", teamMemberId: "member-b", teamMemberName: "Blair" },
    { id: "update-3", issueId: "issue-2", updateType: "immediate_action", note: "Keep monitoring", status: "monitoring", createdAt: "2026-07-15T08:07:00.000Z", teamMemberId: "member-c", teamMemberName: "Casey" },
  ],
  rechecks: [
    { id: "recheck-1", issueId: "issue-1", temperature: 5.4, result: "pass", createdAt: "2026-07-15T08:11:00.000Z", teamMemberId: "member-b", teamMemberName: "Blair" },
  ],
});

const failedReadings = chronology.filter(event => event.eventType === "temperature_reading");
check(failedReadings.length === 2, "both failed fridge readings remain visible");
check(failedReadings.every(event => event.result === "fail"), "resolution does not mutate original reading results");
check(failedReadings.find(event => event.sourceRecordId === "reading-1")?.relatedIssueId === "issue-1", "first failed reading links to its own issue");
check(failedReadings.find(event => event.sourceRecordId === "reading-2")?.relatedIssueId === "issue-2", "second failed reading links to its own issue");

const lifecycle = chronology.filter(event => event.relatedIssueId === "issue-1");
check(lifecycle.some(event => event.eventType === "issue_created"), "issue creation remains in journey");
check(lifecycle.some(event => event.eventType === "issue_update"), "corrective action remains in journey");
check(lifecycle.some(event => event.eventType === "issue_recheck" && event.result === "pass"), "passing recheck remains separate");
check(lifecycle.some(event => event.eventType === "issue_resolved" && event.result === "resolved"), "resolution remains separate");
check(lifecycle.find(event => event.eventType === "issue_recheck")?.teamMemberName === "Blair", "recheck actor is preserved");
check(lifecycle.find(event => event.eventType === "issue_resolved")?.teamMemberName === "Blair", "resolution actor is preserved");
check(lifecycle.find(event => event.eventType === "temperature_reading")?.result === "fail", "issue journey keeps the original failed reading");

const reportService = await readFile(new URL("../src/server/reports/service.ts", import.meta.url), "utf8");
const reportUi = await readFile(new URL("../src/components/ComplianceReports.tsx", import.meta.url), "utf8");
const dayUi = await readFile(new URL("../src/components/MobileDayView.tsx", import.meta.url), "utf8");
const exportService = await readFile(new URL("../src/server/reports/export.ts", import.meta.url), "utf8");
check(reportService.includes('row.result === "fail"'), "report exceptions are based on stored failure result");
check(reportService.includes("daysWithTemperatureFailure"), "failure-day summary remains present");
check(reportService.includes("relatedIssueId"), "report exposes the linked issue");
check(reportService.includes("latestRecheck"), "report exposes latest recheck separately");
check(reportUi.includes("Original result") && reportUi.includes("Failed"), "report UI labels original failure");
check(reportUi.includes("View issue"), "report UI links a temperature exception to its issue");
check(dayUi.includes("responseLabel(event.result)"), "historical chronology uses factual result labels");
check(exportService.includes('exception.result === "fail" ? "Failed"'), "CSV/XLSX preserve Failed result text");
check(exportService.includes("Corrective Action Status"), "exports keep resolution state separate");

const exportReport = {
  location: { name: "Blackpool North", timezone: "Europe/London" },
  range: { start: "2026-07-15", end: "2026-07-15", timezone: "Europe/London" },
  summary: { daysEvaluated: 1, completeDays: 1, incompleteDays: 0, correctiveActionDays: 1, daysWithTemperatureFailure: 1, daysWithProbeFailure: 0, completionRate: 1 },
  sections: {},
  days: [],
  exceptions: [{ date: "2026-07-15", occurredAt: "2026-07-15T08:04:00.000Z", type: "temperature", label: "Fridge 1", value: "9.1°C", result: "fail", teamMemberName: "Alex", relatedIssueId: "issue-1", issueStatusLabel: "Resolved", correctiveActionStatus: "Issue resolved", latestRecheck: { temperature: 5.4, result: "pass", occurredAt: "2026-07-15T08:11:00.000Z", teamMemberName: "Blair" } }],
  issues: { openAtRangeEnd: 0, rows: [{ id: "issue-1", title: "Fridge 1 requires action", category: "Temperature", createdAt: "2026-07-15T08:04:00.000Z", status: "resolved", resolvedAt: "2026-07-15T08:12:00.000Z", teamMemberName: "Alex", recheckCount: 1, latestUpdate: null }] },
  additional: { rows: [] },
};
const exportedCsv = renderComplianceCsv(exportReport).toString("utf8");
check(exportedCsv.includes('"Failed"'), "CSV exports original temperature failure");
check(exportedCsv.includes('"Resolved","Issue resolved"'), "CSV exports resolution separately");
const exportedWorkbook = new ExcelJS.Workbook();
await exportedWorkbook.xlsx.load(await renderComplianceWorkbook(exportReport));
const exceptionSheetText = exportedWorkbook.getWorksheet("Exceptions").getRows(1, exportedWorkbook.getWorksheet("Exceptions").rowCount).map(row => row.values).flat().join(" ");
check(exceptionSheetText.includes("Failed"), "XLSX exports original temperature failure");
check(exceptionSheetText.includes("Resolved") && exceptionSheetText.includes("Issue resolved"), "XLSX exports resolution separately");

console.log(`Temperature resolution tests passed: ${passed}/30`);
