import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { issueUpdateActionLabel, selectIssueStatus, selectIssueUpdateType } from "../src/components/issue-detail-actions.ts";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const [temperatureService, issueService, actionUi, workflow, managerReviews, inspection, issueDetail] = await Promise.all([
  read("src/server/compliance/temperature-service.ts"),
  read("src/server/compliance/issue-service.ts"),
  read("src/components/TemperatureActionScreen.tsx"),
  read("src/components/dashboard/useDashboardWorkflows.ts"),
  read("src/components/ManagerReviews.tsx"),
  read("src/components/MobileDayView.tsx"),
  read("src/components/IssueDetail.tsx"),
]);
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed += 1; };
const equalCheck = (actual, expected, message) => { assert.deepEqual(actual, expected, message); passed += 1; };

check(temperatureService.includes("Every failed fridge must have a corrective action before completing the round"), "failed readings still require immediate corrective action");
check(!temperatureService.includes("Every failed fridge must have a recheck before completing the round"), "round completion does not require an immediate recheck");
check(issueService.includes('updateType: "immediate_action"'), "immediate corrective action is recorded in issue history");
check(!issueService.includes('set({ action, status: "monitoring" })'), "immediate action does not skip the initial Open state");
check(issueService.includes('input.status === "resolved" && issue.category === "Temperature"'), "temperature resolution uses corrective evidence");
check(issueService.includes('issue.category === "Probe"'), "probe resolution rule remains protected");
check(actionUi.includes('<select disabled={progress.actionsSaved} value={progress.action}'), "corrective action uses a select control");
check(actionUi.includes("Additional notes (optional)"), "corrective action notes are optional");
check(actionUi.includes("Save corrective action"), "corrective action has one clear save action");
check(!actionUi.includes("StaffAttributionLine"), "corrective action does not repeat a staff selector per fridge");
check(!actionUi.includes("Rechecked temperature"), "recheck is not an immediate corrective action option");
check(!actionUi.includes('aria-label="Mark complete"'), "misleading Mark complete wording is removed");
check(actionUi.includes("Corrective action recorded"), "daily flow shows a concise saved action state");
check(actionUi.includes("Finish recording completion"), "round completion has a retry-only recovery action");
check(workflow.includes("issueActionSubmittingRef"), "repeated action submissions are guarded");
check(workflow.includes("await completeRound({ roundId"), "round completes after corrective actions");
check(managerReviews.includes("<IssueDetail"), "manager View issue opens actionable issue detail");
check(managerReviews.includes("correctiveActions"), "manager review exposes issue action activity");
check(issueDetail.includes("selection.updateType"), "issue action wording follows the submitted update type");
check(issueDetail.includes("issueUpdateActionLabel(selection.updateType)"), "issue detail uses the selected action for its label");
check(!issueDetail.includes("Save update"), "generic Save update wording is removed");
let selection = { updateType: "further_action", status: "open" };
selection = selectIssueUpdateType(selection, "resolution");
equalCheck(selection, { updateType: "resolution", status: "resolved" }, "resolution selection submits a resolved resolution update");
check(issueUpdateActionLabel(selection.updateType) === "Resolve issue", "resolution selection uses Resolve issue label");
selection = selectIssueStatus(selection, "monitoring");
equalCheck(selection, { updateType: "further_action", status: "monitoring" }, "monitoring selection submits a further action update");
check(issueUpdateActionLabel(selection.updateType) === "Add update", "monitoring selection uses Add update label");
selection = selectIssueStatus(selection, "resolved");
equalCheck(selection, { updateType: "resolution", status: "resolved" }, "resolved status cannot submit a further action update");
check(issueUpdateActionLabel(selection.updateType) === "Resolve issue", "resolved status uses Resolve issue label");
check(inspection.includes("All recorded readings, grouped by temperature round"), "inspection groups fridge readings by round");
check(inspection.includes("Detailed inspection chronology"), "detailed chronology is secondary to the grouped inspection view");
check(inspection.includes("View issue journey"), "grouped failed reading links to its issue journey");

console.log(`Temperature issue lifecycle tests passed: ${passed}/27`);
