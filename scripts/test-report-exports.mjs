import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import {
  filenameForReport,
  formatLocalTimestamp,
  renderComplianceCsv,
  renderComplianceWorkbook,
  safeText,
} from "../src/server/reports/export.ts";
import { reportDateRange } from "../src/server/reports/calculations.ts";

const exportRoute = await readFile(new URL("../api/reports/compliance/export.ts", import.meta.url), "utf8");
const reportService = await readFile(new URL("../src/server/reports/service.ts", import.meta.url), "utf8");
const reportUi = await readFile(new URL("../src/components/ComplianceReports.tsx", import.meta.url), "utf8");
const adminUi = await readFile(new URL("../src/components/AdminSetup.tsx", import.meta.url), "utf8");

const report = {
  location: { name: "Le Feast / Blackpool North", shortName: "Blackpool North", timezone: "Europe/London" },
  range: { start: "2026-07-15", end: "2026-07-16", timezone: "Europe/London" },
  summary: {
    daysEvaluated: 1,
    completeDays: 1,
    incompleteDays: 0,
    correctiveActionDays: 0,
    daysWithOpenIssueAtStart: 0,
    daysWithTemperatureFailure: 0,
    daysWithProbeFailure: 0,
    completionRate: 1,
  },
  sections: {
    temperature_am: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    temperature_pm: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    opening_checklist: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    closing_checklist: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    security_am: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    security_pm: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    food_probes: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    cleaning: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    wastage: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
    additional_checks: { requiredDays: 1, completedDays: 1, incompleteDays: 0, completionRate: 1 },
  },
  days: [{
    date: "2026-07-15",
    status: "green",
    complete: true,
    correctiveActionRecorded: false,
    sections: {
      temperature_am: true,
      temperature_pm: true,
      opening_checklist: true,
      closing_checklist: true,
      security_am: true,
      security_pm: true,
      food_probes: true,
      cleaning: true,
      wastage: true,
      additional_checks: true,
    },
    counts: {
      temperatureReadings: 4,
      foodProbes: 2,
      checklistResponses: 5,
      securityResponses: 4,
      cleaningCompletions: 3,
      wastageRecords: 1,
      additionalChecks: 1,
      issueEvents: 0,
    },
  }],
  exceptions: [{
    type: "temperature",
    date: "2026-07-15",
    occurredAt: "2026-07-15T12:00:00.000Z",
    label: "Fridge 1",
    value: "4.3°C",
    result: "pass",
    teamMemberName: "James",
    relatedIssueId: null,
  }],
  issues: {
    issuesCreated: 0,
    issuesResolved: 0,
    rechecksRecorded: 0,
    openAtRangeEnd: 0,
    rows: [{
      id: "issue-1",
      title: "Corrective action",
      category: "temperature",
      createdAt: "2026-07-15T12:00:00.000Z",
      status: "resolved",
      resolvedAt: "2026-07-15T12:10:00.000Z",
      teamMemberName: "James",
      recheckCount: 1,
      latestUpdate: {
        note: "Continue cooking, then recheck",
        occurredAt: "2026-07-15T12:05:00.000Z",
        teamMemberName: "James",
      },
    }],
  },
  wastage: { totalRecords: 1, noWasteRecords: 0, daysWithRecord: 1, evaluatedDaysMissingEvidence: 0 },
  additional: {
    due: 1,
    completed: 1,
    incomplete: 0,
    rows: [{
      requirementTitle: "Pest control check",
      scheduledDueDate: "2026-07-15",
      completedAt: "2026-07-15T13:00:00.000Z",
      teamMemberName: "James",
      certificatePresent: true,
      documentUrl: "/api/documents/private-document-id",
      documentStorageId: "must-not-export",
    }],
  },
};

const formulaReport = structuredClone(report);
formulaReport.exceptions[0].label = "=unsafe, \"label\"\nnext";
formulaReport.issues.rows[0].title = "+issue title";
formulaReport.additional.rows[0].requirementTitle = "@requirement";

assert.match(exportRoute, /requireContext/);
assert.match(exportRoute, /complianceReport/);
assert.match(reportService, /requireLocationManager/);
assert.match(exportRoute, /format must be csv or xlsx/);
assert.match(exportRoute, /Content-Disposition/);
assert.match(exportRoute, /Cache-Control/);
assert.match(reportUi, /credentials: "include"/);
assert.match(reportUi, /Download CSV/);
assert.match(reportUi, /Download Excel/);
assert.match(reportUi, /Preparing/);

assert.deepEqual(reportDateRange("2026-07-15", "2026-07-16").days, ["2026-07-15", "2026-07-16"], "valid dates accepted");
assert.throws(() => reportDateRange("2026-07-17", "2026-07-16"), /invalid/, "backwards range rejected");
assert.throws(() => reportDateRange("2026-01-01", "2027-01-02"), /too large/, "range over 366 days rejected");

const csv = renderComplianceCsv(report, "2026-07-16T12:00:00.000Z").toString("utf8");
const formulaCsv = renderComplianceCsv(formulaReport, "2026-07-16T12:00:00.000Z").toString("utf8");
assert.match(csv, /^\uFEFF/, "CSV is UTF-8 BOM compatible");
assert.match(csv, /\"Store\",\"Blackpool North\"/);
assert.match(csv, /\"Start Date\",\"2026-07-15\"/);
assert.match(csv, /\"End Date\",\"2026-07-16\"/);
assert.match(csv, /\"Timezone\",\"Europe\/London\"/);
assert.match(csv, /\"Complete Days\",\"1\"/, "summary matches canonical report");
assert.match(csv, /\"AM temperatures\",\"1\",\"1\",\"0\",\"100%\"/, "section matches canonical report");
assert.match(csv, /\"2026-07-15\",\"green\",\"Yes\",\"No\"/, "daily status matches canonical report");
assert.match(csv, /\"Fridge 1\",\"pass\",\"4\.3°C\",\"James\"/, "exception matches canonical report");
assert.match(csv, /\"issue-1\",\"Corrective action\"/, "issue rows match canonical report");
assert.match(csv, /\"Pest control check\",\"2026-07-15\"/, "additional rows match canonical report");
assert.match(formulaCsv, /'=unsafe, ""label""\nnext/, "CSV formula, quote and newline safety");
assert.ok(formulaCsv.includes("\"issue-1\",\"'+issue title\""), "CSV protects issue formulas");
assert.ok(formulaCsv.includes("\"'@requirement\",\"2026-07-15\""), "CSV protects additional-check formulas");
assert.match(csv, /Blackpool North/, "commas/slashes remain data, not filename syntax");
assert.doesNotMatch(csv, /documentStorageId|must-not-export|private-document-id|blob:/, "CSV excludes private storage metadata");
assert.equal(safeText("=formula"), "'=formula");
assert.equal(safeText("ordinary"), "ordinary");

const emptyReport = structuredClone(report);
emptyReport.summary.daysEvaluated = 0;
emptyReport.summary.completeDays = 0;
emptyReport.summary.incompleteDays = 0;
emptyReport.summary.completionRate = null;
emptyReport.days = [];
const emptyCsv = renderComplianceCsv(emptyReport, "2026-01-15T12:00:00.000Z").toString("utf8");
assert.match(emptyCsv, /\"Evaluated Days\",\"0\"/);
assert.match(emptyCsv, /\"Completion Rate\",\"\"/, "null completion rate remains blank");
assert.match(emptyCsv, /\"DAILY BREAKDOWN\"\n\"Date\"/, "zero-day report keeps tabular headers");

assert.equal(formatLocalTimestamp("2026-01-15T12:00:00.000Z", "Europe/London").includes("12:00:00"), true, "GMT timestamps stay local");
assert.equal(formatLocalTimestamp("2026-07-15T12:00:00.000Z", "Europe/London").includes("13:00:00"), true, "BST timestamps stay local");
const filename = filenameForReport(report, "csv");
assert.equal(filename, "le-feast-compliance-blackpool-north-2026-07-15-to-2026-07-16.csv");
assert.doesNotMatch(filename, /[\\\\/]|\\.\\./, "filename cannot traverse paths");
assert.equal(filenameForReport(report, "xlsx").endsWith(".xlsx"), true);

const workbookBuffer = await renderComplianceWorkbook(formulaReport, "2026-07-16T12:00:00.000Z");
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.load(workbookBuffer);
assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ["Summary", "Daily Breakdown", "Exceptions", "Issues", "Additional Checks", "Section Completion"]);
assert.equal(workbook.getWorksheet("Summary").getCell("A1").value, "Le Feast Compliance Report");
const summarySheet = workbook.getWorksheet("Summary");
const completeRow = summarySheet.getRows(1, summarySheet.rowCount).find(row => row.getCell(1).value === "Complete Days");
assert.equal(completeRow?.getCell(2).value, 1, "XLSX summary matches canonical report");
const xlsxValues = workbook.worksheets.flatMap(sheet => sheet.getRows(1, sheet.rowCount).map(row => row.values).flat()).join(" ");
assert.ok(xlsxValues.includes("'=unsafe, \"label\""), "XLSX formula safety");
assert.doesNotMatch(xlsxValues, /documentStorageId|must-not-export|private-document-id|blob:/, "XLSX excludes private storage metadata");
assert.equal(summarySheet.views[0].state, "frozen", "summary freezes the top row");
assert.equal(workbook.getWorksheet("Daily Breakdown").views[0].state, "frozen", "daily breakdown freezes the top row");

assert.doesNotMatch(adminUi, /function exportWastage|URL\.createObjectURL\(new Blob/, "old browser-only wastage export is removed");

console.log("Report export tests passed: 35/35");
