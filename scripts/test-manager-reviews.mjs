import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { completedReviewPeriod, FSA_REVIEW_QUESTIONS, nextOutstandingReviewPeriod, reviewPeriodState } from "../src/server/reviews/service.ts";
import { renderComplianceCsv, renderComplianceWorkbook } from "../src/server/reports/export.ts";
import ExcelJS from "exceljs";

const service = await readFile(new URL("../src/server/reviews/service.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../api/manager-reviews.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../src/components/ManagerReviews.tsx", import.meta.url), "utf8");
const report = await readFile(new URL("../src/server/reports/service.ts", import.meta.url), "utf8");
const exportService = await readFile(new URL("../src/server/reports/export.ts", import.meta.url), "utf8");
const schema = await readFile(new URL("../src/server/db/schema.ts", import.meta.url), "utf8");

const weekly = completedReviewPeriod("Europe/London", "weekly", Date.parse("2026-10-04T12:00:00Z"));
const fourWeekly = completedReviewPeriod("Europe/London", "four_weekly", Date.parse("2026-10-04T12:00:00Z"));
assert.deepEqual(weekly, { reviewType: "weekly", start: "2026-09-21", end: "2026-09-27" });
assert.deepEqual(fourWeekly, { reviewType: "four_weekly", start: "2026-08-31", end: "2026-09-27" });
assert.deepEqual(nextOutstandingReviewPeriod([], "Europe/London", "weekly", Date.parse("2026-10-04T12:00:00Z")), weekly);
assert.equal(reviewPeriodState(weekly, "Europe/London", false, Date.parse("2026-10-04T12:00:00Z")).status, "overdue");
const firstCompletedWeekly = [{ periodStart: "2026-09-21", periodEnd: "2026-09-27" }];
const nextWeekly = nextOutstandingReviewPeriod(firstCompletedWeekly, "Europe/London", "weekly", Date.parse("2026-10-11T12:00:00Z"));
assert.deepEqual(nextWeekly, { reviewType: "weekly", start: "2026-09-28", end: "2026-10-04" });
assert.equal(reviewPeriodState(nextWeekly, "Europe/London", false, Date.parse("2026-10-11T12:00:00Z")).status, "overdue");
const secondCompletedWeekly = [...firstCompletedWeekly, { periodStart: "2026-09-28", periodEnd: "2026-10-04" }];
assert.equal(nextOutstandingReviewPeriod(secondCompletedWeekly, "Europe/London", "weekly", Date.parse("2026-10-06T12:00:00Z")), null, "the current incomplete week is not available");
assert.deepEqual(nextOutstandingReviewPeriod(secondCompletedWeekly, "Europe/London", "weekly", Date.parse("2026-10-18T12:00:00Z")), { reviewType: "weekly", start: "2026-10-05", end: "2026-10-11" });
const upToDateWeekly = [...secondCompletedWeekly, { periodStart: "2026-10-05", periodEnd: "2026-10-11" }];
assert.equal(nextOutstandingReviewPeriod(upToDateWeekly, "Europe/London", "weekly", Date.parse("2026-10-18T12:00:00Z")), null, "up-to-date weekly reviews do not expose a future week");
const skippedWeekly = [...firstCompletedWeekly, { periodStart: "2026-10-05", periodEnd: "2026-10-11" }];
assert.deepEqual(nextOutstandingReviewPeriod(skippedWeekly, "Europe/London", "weekly", Date.parse("2026-10-18T12:00:00Z")), { reviewType: "weekly", start: "2026-09-28", end: "2026-10-04" }, "oldest outstanding week is returned first");
assert.equal(reviewPeriodState(null, "Europe/London", false, Date.parse("2026-10-06T12:00:00Z"), "weekly").status, "up_to_date");
const firstCompletedFourWeekly = [{ periodStart: "2026-08-31", periodEnd: "2026-09-27" }];
const nextFourWeekly = nextOutstandingReviewPeriod(firstCompletedFourWeekly, "Europe/London", "four_weekly", Date.parse("2026-11-01T12:00:00Z"));
assert.deepEqual(nextFourWeekly, { reviewType: "four_weekly", start: "2026-09-28", end: "2026-10-25" });
assert.equal(reviewPeriodState(nextFourWeekly, "Europe/London", false, Date.parse("2026-11-01T12:00:00Z")).status, "overdue");
assert.deepEqual(nextOutstandingReviewPeriod([...firstCompletedFourWeekly, { periodStart: "2026-09-28", periodEnd: "2026-10-25" }], "Europe/London", "four_weekly", Date.parse("2026-12-01T12:00:00Z")), { reviewType: "four_weekly", start: "2026-10-26", end: "2026-11-22" });
assert.equal(nextOutstandingReviewPeriod([...firstCompletedFourWeekly, { periodStart: "2026-09-28", periodEnd: "2026-10-25" }], "Europe/London", "four_weekly", Date.parse("2026-10-06T12:00:00Z")), null, "the incomplete four-week cycle is not available");
assert.equal(reviewPeriodState(null, "Europe/London", false, Date.parse("2026-10-06T12:00:00Z"), "four_weekly").status, "up_to_date");
assert.equal(FSA_REVIEW_QUESTIONS.length, 12);
assert.match(service, /requireLocationManager/);
assert.match(service, /outstandingIssues/);
assert.match(service, /updateType: "manager_review"/);
assert.match(service, /db\(\)\.transaction/);
assert.match(service, /seriousProblems/);
assert.match(service, /repeatProblems/);
assert.match(service, /Current position \/ next action is required for every open or monitoring issue/);
assert.match(service, /inArray\(issues.status, \["open", "monitoring"\]\)/);
assert.match(service, /No completed review period is available/);
assert.match(service, /latestEligible\.end/);
assert.match(route, /completeManagerReview/);
assert.match(route, /getManagerReviews/);
assert.match(ui, /Issues &amp; Reviews/);
assert.match(ui, /No issues requiring manager follow-up this week/);
assert.match(ui, /Complete weekly review/);
assert.match(ui, /Complete 4-week review/);
assert.match(ui, /periodStatusLabel/);
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const dashboardToday = await readFile(new URL("../src/components/dashboard/DashboardToday.tsx", import.meta.url), "utf8");
assert.match(dashboard, /managerReviewStatus/);
assert.match(dashboardToday, /Weekly review/);
assert.match(dashboardToday, /canUseManagement/);
assert.match(ui, /Have you reviewed your safe methods/);
assert.match(report, /managerReviews/);
assert.match(exportService, /MANAGER REVIEWS/);
assert.match(exportService, /Manager Reviews/);
assert.match(schema, /managerReviews = pgTable\("manager_reviews"/);
assert.doesNotMatch(schema, /assigned_user_id|checklist_owner|primary_team_member/);

const exportReport = {
  location: { name: "Blackpool North", shortName: "blackpool", timezone: "Europe/London" },
  range: { start: "2026-08-31", end: "2026-09-27", timezone: "Europe/London" },
  summary: { daysEvaluated: 0, completeDays: 0, incompleteDays: 0, correctiveActionDays: 0, daysWithTemperatureFailure: 0, daysWithProbeFailure: 0, completionRate: null },
  sections: {}, days: [], exceptions: [], issues: { openAtRangeEnd: 0, rows: [] }, additional: { rows: [] },
  managerReviews: { rows: [{ reviewType: "weekly", periodStart: "2026-09-21", periodEnd: "2026-09-27", completedAt: "2026-09-28T09:00:00.000Z", completedBy: "Manager", summary: { issuesRaised: 1 }, seriousProblems: null, details: null, actionTaken: null, answers: null }] },
};
const csv = renderComplianceCsv(exportReport, "2026-10-04T12:00:00.000Z").toString("utf8");
assert.match(csv, /MANAGER REVIEWS/);
assert.match(csv, /2026-09-21/);
const workbook = await renderComplianceWorkbook(exportReport, "2026-10-04T12:00:00.000Z");
const parsedWorkbook = new ExcelJS.Workbook();
await parsedWorkbook.xlsx.load(workbook);
assert.ok(parsedWorkbook.getWorksheet("Manager Reviews"));

console.log("Manager review tests passed: 43/43");
