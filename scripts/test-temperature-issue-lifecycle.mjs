import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const [temperatureService, issueService, actionUi, workflow, managerReviews, inspection] = await Promise.all([
  read("src/server/compliance/temperature-service.ts"),
  read("src/server/compliance/issue-service.ts"),
  read("src/components/TemperatureActionScreen.tsx"),
  read("src/components/dashboard/useDashboardWorkflows.ts"),
  read("src/components/ManagerReviews.tsx"),
  read("src/components/MobileDayView.tsx"),
]);
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };

check(temperatureService.includes("Every failed fridge must have a corrective action before completing the round"), "failed readings still require immediate corrective action");
check(!temperatureService.includes("Every failed fridge must have a recheck before completing the round"), "round completion does not require an immediate recheck");
check(issueService.includes('updateType: "immediate_action"'), "immediate corrective action is recorded in issue history");
check(!issueService.includes('set({ action, status: "monitoring" })'), "immediate action does not skip the initial Open state");
check(!issueService.includes("must be resolved by a passing recheck"), "issue resolution is not blocked on a recheck");
check(actionUi.includes('<select disabled={progress.actionsSaved} value={progress.action}'), "corrective action uses a select control");
check(actionUi.includes("Reason / notes"), "corrective action accepts a reason or note");
check(!actionUi.includes("Rechecked temperature"), "recheck is not an immediate corrective action option");
check(actionUi.includes('aria-label="Mark complete"'), "green tick completion has an accessible label");
check(actionUi.includes("Issue reported"), "daily flow shows issue reported after action");
check(workflow.includes("issueActionSubmittingRef"), "repeated action submissions are guarded");
check(workflow.includes("await completeRound({ roundId"), "round completes after corrective actions");
check(managerReviews.includes("<IssueDetail"), "manager View issue opens actionable issue detail");
check(managerReviews.includes("correctiveActions"), "manager review exposes issue action activity");
check(inspection.includes("Grouped by completed temperature round"), "inspection groups fridge readings by round");
check(inspection.includes("Detailed inspection chronology"), "detailed chronology is secondary to the grouped inspection view");
check(inspection.includes("View issue journey"), "grouped failed reading links to its issue journey");

console.log(`Temperature issue lifecycle tests passed: ${passed}/17`);
