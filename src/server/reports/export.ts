/* eslint-disable @typescript-eslint/no-explicit-any */
import ExcelJS from "exceljs";
import { resultLabel } from "../../lib/temperature-resolution.js";

export type ComplianceReport = {
  location: { name?: string | null; shortName?: string | null; timezone: string };
  range: { start: string; end: string; timezone: string };
  summary: {
    daysEvaluated: number;
    completeDays: number;
    incompleteDays: number;
    correctiveActionDays: number;
    daysWithTemperatureFailure: number;
    daysWithProbeFailure: number;
    completionRate: number | null;
  };
  sections: Record<string, { requiredDays: number; completedDays: number; incompleteDays: number; completionRate: number | null }>;
  days: Array<Record<string, any>>;
  exceptions: Array<Record<string, any>>;
  issues: {
    openAtRangeEnd: number;
    rows: Array<Record<string, any>>;
  };
  additional: {
    rows: Array<Record<string, any>>;
  };
  managerReviews?: {
    rows: Array<Record<string, any>>;
  };
};

export type ExportFormat = "csv" | "xlsx";

const SECTION_ORDER = [
  "temperature_am",
  "temperature_pm",
  "opening_checklist",
  "closing_checklist",
  "security_am",
  "security_pm",
  "food_probes",
  "cleaning",
  "wastage",
  "additional_checks",
] as const;

const SECTION_LABELS: Record<string, string> = {
  temperature_am: "AM temperatures",
  temperature_pm: "PM temperatures",
  opening_checklist: "Opening checklist",
  closing_checklist: "Closing checklist",
  security_am: "AM security",
  security_pm: "PM security",
  food_probes: "Food probes",
  cleaning: "Cleaning",
  wastage: "Wastage",
  additional_checks: "Additional checks",
};

const DAILY_HEADERS = [
  "Date",
  "Status",
  "Complete",
  "Corrective Action Recorded",
  "AM Temperatures",
  "PM Temperatures",
  "Opening Checklist",
  "Closing Checklist",
  "AM Security",
  "PM Security",
  "Food Probes",
  "Cleaning",
  "Cleaning Evidence",
  "Wastage",
  "Additional Checks",
  "Temperature Readings",
  "Food Probe Records",
  "Checklist Responses",
  "Security Responses",
  "Cleaning Completions",
  "Wastage Records",
  "Additional Checks Completed",
  "Issue Events",
];

const SECTION_HEADERS = ["Section", "Required Days", "Completed Days", "Incomplete Days", "Completion Rate"];

const boolLabel = (value: unknown) => value ? "Yes" : "No";
const rateLabel = (value: unknown) => typeof value === "number" ? `${Math.round(value * 100)}%` : "";

/** Prefix text that spreadsheet applications could interpret as a formula. */
export const safeText = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const cellValue = (value: unknown): string | number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return safeText(value);
};

export const formatLocalTimestamp = (value: unknown, timeZone: string) => {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return safeText(value);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
};

const csvEscape = (value: unknown) => `"${String(cellValue(value)).replace(/"/g, '""')}"`;
const csvRow = (values: unknown[]) => values.map(csvEscape).join(",");

const reportStoreName = (report: ComplianceReport) => report.location.shortName || report.location.name || "Store";

export const filenameForReport = (report: ComplianceReport, format: ExportFormat) => {
  const store = reportStoreName(report)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80) || "store";
  return `le-feast-compliance-${store}-${report.range.start}-to-${report.range.end}.${format}`;
};

const metadataRows = (report: ComplianceReport, generatedAt: string) => [
  ["Store", reportStoreName(report)],
  ["Start Date", report.range.start],
  ["End Date", report.range.end],
  ["Timezone", report.range.timezone],
  ["Generated At", formatLocalTimestamp(generatedAt, report.range.timezone)],
];

const summaryRows = (report: ComplianceReport) => [
  ["Evaluated Days", report.summary.daysEvaluated],
  ["Complete Days", report.summary.completeDays],
  ["Incomplete Days", report.summary.incompleteDays],
  ["Corrective Action Days", report.summary.correctiveActionDays],
  ["Completion Rate", rateLabel(report.summary.completionRate)],
  ["Days With Temperature Failure", report.summary.daysWithTemperatureFailure],
  ["Days With Probe Failure", report.summary.daysWithProbeFailure],
  ["Open Issues At Range End", report.issues.openAtRangeEnd],
];

const sectionRows = (report: ComplianceReport) => SECTION_ORDER.map(key => {
  const section = report.sections[key] ?? { requiredDays: 0, completedDays: 0, incompleteDays: 0, completionRate: null };
  return [SECTION_LABELS[key], section.requiredDays, section.completedDays, section.incompleteDays, rateLabel(section.completionRate)];
});

const dailyRows = (report: ComplianceReport) => report.days.map(day => {
  const sections = day.sections ?? {};
  const counts = day.counts ?? {};
  const cleaningEvidence = [
    day.cleaningStatus === "complete" ? "Cleaning required and completed" : "",
    day.cleaningStatus === "incomplete" ? "Cleaning required but missed" : "",
    day.afterUseCleaningStatus === "recorded" ? "Cleaning recorded" : "",
    day.afterUseCleaningStatus === "not_verifiable" || day.cleaningStatus === "not_verifiable" ? "Usage requirement: Not verifiable" : "",
  ].filter(Boolean).join(" · ") || "No cleaning scheduled";
  return [
    day.date,
    day.status,
    boolLabel(day.complete),
    boolLabel(day.correctiveActionRecorded),
    boolLabel(sections.temperature_am),
    boolLabel(sections.temperature_pm),
    boolLabel(sections.opening_checklist),
    boolLabel(sections.closing_checklist),
    boolLabel(sections.security_am),
    boolLabel(sections.security_pm),
    boolLabel(sections.food_probes),
    boolLabel(sections.cleaning),
    cleaningEvidence,
    boolLabel(sections.wastage),
    boolLabel(sections.additional_checks),
    counts.temperatureReadings ?? 0,
    counts.foodProbes ?? 0,
    counts.checklistResponses ?? 0,
    counts.securityResponses ?? 0,
    counts.cleaningCompletions ?? 0,
    counts.wastageRecords ?? 0,
    counts.additionalChecks ?? 0,
    counts.issueEvents ?? 0,
  ];
});

const exceptionRows = (report: ComplianceReport) => report.exceptions.map(exception => [
  exception.date,
  formatLocalTimestamp(exception.occurredAt, report.range.timezone),
  exception.type,
  exception.label,
  exception.result === "fail" ? "Failed" : exception.result,
  exception.value ?? exception.detail ?? "",
  exception.teamMemberName ?? "Not recorded",
  exception.relatedIssueId ?? "",
  exception.issueStatusLabel ?? exception.issueStatus ?? "",
  exception.correctiveActionStatus ?? "",
  exception.latestRecheck ? `${exception.latestRecheck.temperature}°C · ${resultLabel(exception.latestRecheck.result)} · ${formatLocalTimestamp(exception.latestRecheck.occurredAt, report.range.timezone)} · ${exception.latestRecheck.teamMemberName ?? "Not recorded"}` : "",
]);

const issueRows = (report: ComplianceReport) => report.issues.rows.map(issue => [
  issue.id,
  issue.title,
  issue.category,
  formatLocalTimestamp(issue.createdAt, report.range.timezone),
  issue.status,
  formatLocalTimestamp(issue.resolvedAt, report.range.timezone),
  issue.teamMemberName ?? "Not recorded",
  issue.recheckCount ?? 0,
  issue.latestUpdate?.note ?? "",
  formatLocalTimestamp(issue.latestUpdate?.occurredAt, report.range.timezone),
  issue.latestUpdate?.teamMemberName ?? "Not recorded",
]);

const additionalRows = (report: ComplianceReport) => report.additional.rows.map(row => [
  row.requirementTitle,
  row.scheduledDueDate,
  formatLocalTimestamp(row.completedAt, report.range.timezone),
  row.teamMemberName ?? "Not recorded",
  boolLabel(row.certificatePresent),
]);

const managerReviewRows = (report: ComplianceReport) => (report.managerReviews?.rows ?? []).map(row => [
  row.reviewType === "four_weekly" ? "4-weekly review" : "Weekly review",
  row.periodStart,
  row.periodEnd,
  formatLocalTimestamp(row.completedAt, report.range.timezone),
  row.completedBy ?? "Not recorded",
  row.summary?.issuesRaised ?? 0,
  row.summary?.issuesResolved ?? 0,
  row.summary?.outstandingIssues ?? 0,
  row.summary?.failedTemperatureChecks ?? 0,
  row.summary?.failedProbeChecks ?? 0,
  row.seriousProblems == null ? "" : boolLabel(row.seriousProblems),
  row.details ?? "",
  row.actionTaken ?? "",
  row.answers ? JSON.stringify(row.answers) : "",
]);

export const renderComplianceCsv = (report: ComplianceReport, generatedAt = new Date().toISOString()) => {
  const rows: unknown[][] = [
    ["REPORT METADATA"],
    ...metadataRows(report, generatedAt),
    [],
    ["SUMMARY"],
    ["Metric", "Value"],
    ...summaryRows(report),
    [],
    ["SECTION COMPLETION"],
    SECTION_HEADERS,
    ...sectionRows(report),
    [],
    ["DAILY BREAKDOWN"],
    DAILY_HEADERS,
    ...dailyRows(report),
    [],
    ["EXCEPTIONS"],
    ["Date", "Time", "Type", "Item / Question", "Result", "Value / Detail", "Team Member", "Related Issue ID", "Issue Status", "Corrective Action Status", "Latest Recheck"],
    ...exceptionRows(report),
    [],
    ["ISSUES"],
    ["Issue ID", "Title", "Category", "Created At", "Status At Range End", "Resolved At", "Team Member", "Recheck Count", "Latest Action", "Latest Action Time", "Latest Action Team Member"],
    ...issueRows(report),
    [],
    ["ADDITIONAL CHECKS"],
    ["Requirement", "Scheduled Due Date", "Completed At", "Team Member", "Certificate Present"],
    ...additionalRows(report),
    [],
    ["MANAGER REVIEWS"],
    ["Review Type", "Period Start", "Period End", "Completed At", "Completed By", "Issues Raised", "Issues Resolved", "Outstanding Issues", "Failed Temperature Checks", "Failed Probe Checks", "Serious Problems", "Details", "Action Taken", "FSA Answers"],
    ...managerReviewRows(report),
  ];
  return Buffer.from(`\uFEFF${rows.map(csvRow).join("\n")}\n`, "utf8");
};

const addTable = (sheet: ExcelJS.Worksheet, headers: string[], rows: unknown[][]) => {
  const headerRow = sheet.rowCount + 1;
  sheet.addRow(headers.map(cellValue));
  for (const row of rows) sheet.addRow(row.map(cellValue));
  const header = sheet.getRow(headerRow);
  header.font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, headerRow + rows.length), column: headers.length } };
  for (let index = 1; index <= headers.length; index += 1) {
    const longest = Math.max(headers[index - 1].length, ...rows.map(row => String(row[index - 1] ?? "").length), 10);
    sheet.getColumn(index).width = Math.min(48, longest + 2);
  }
};

export const renderComplianceWorkbook = async (report: ComplianceReport, generatedAt = new Date().toISOString()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Le Feast Compliance";
  workbook.created = new Date(generatedAt);

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Le Feast Compliance Report"]).font = { bold: true, size: 16 };
  for (const row of metadataRows(report, generatedAt)) summary.addRow(row.map(cellValue));
  summary.addRow([]);
  summary.addRow(["Summary metrics"]).font = { bold: true };
  addTable(summary, ["Metric", "Value"], summaryRows(report));
  summary.addRow([]);
  summary.addRow(["Section completion"]).font = { bold: true };
  const sectionStart = summary.rowCount + 1;
  addTable(summary, SECTION_HEADERS, sectionRows(report));
  for (let row = sectionStart + 1; row <= summary.rowCount; row += 1) summary.getCell(row, 5).numFmt = "0%";
  summary.getColumn(1).width = 34;
  summary.getColumn(2).width = 24;

  const daily = workbook.addWorksheet("Daily Breakdown");
  addTable(daily, DAILY_HEADERS, dailyRows(report));

  const exceptions = workbook.addWorksheet("Exceptions");
  addTable(exceptions, ["Date", "Time", "Type", "Item / Question", "Result", "Value / Detail", "Team Member", "Related Issue ID", "Issue Status", "Corrective Action Status", "Latest Recheck"], exceptionRows(report));

  const issues = workbook.addWorksheet("Issues");
  addTable(issues, ["Issue ID", "Title", "Category", "Created At", "Status At Range End", "Resolved At", "Team Member", "Recheck Count", "Latest Action", "Latest Action Time", "Latest Action Team Member"], issueRows(report));

  const additional = workbook.addWorksheet("Additional Checks");
  addTable(additional, ["Requirement", "Scheduled Due Date", "Completed At", "Team Member", "Certificate Present"], additionalRows(report));

  if (report.managerReviews) {
    const reviews = workbook.addWorksheet("Manager Reviews");
    addTable(reviews, ["Review Type", "Period Start", "Period End", "Completed At", "Completed By", "Issues Raised", "Issues Resolved", "Outstanding Issues", "Failed Temperature Checks", "Failed Probe Checks", "Serious Problems", "Details", "Action Taken", "FSA Answers"], managerReviewRows(report));
  }

  const sectionSheet = workbook.addWorksheet("Section Completion");
  addTable(sectionSheet, SECTION_HEADERS, sectionRows(report));

  return Buffer.from(await workbook.xlsx.writeBuffer());
};
