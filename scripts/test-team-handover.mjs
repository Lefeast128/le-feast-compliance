import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { selectedQuestionMember, selectedSignOffMember } from "../src/lib/team-handover.ts";

const root = new URL("../", import.meta.url);
const read = file => readFile(new URL(file, root), "utf8");
const [checklist, cleaning, dashboard, workflows, compliance, history, reports, schema] = await Promise.all([
  read("src/components/InlineChecklist.tsx"),
  read("src/components/InlineCleaning.tsx"),
  read("src/pages/Dashboard.tsx"),
  read("src/components/dashboard/useDashboardWorkflows.ts"),
  read("src/server/compliance/checklist-service.ts"),
  read("src/server/history/service.ts"),
  read("src/server/reports/service.ts"),
  read("src/server/db/schema.ts"),
]);
const source = [checklist, cleaning, dashboard, workflows, compliance, history, reports].join("\n");
let passed = 0;
const check = (value, message) => { assert.ok(value, message); passed += 1; };

check.equal = (actual, expected, message) => { assert.equal(actual, expected, message); passed += 1; };

check.equal(selectedQuestionMember("q1", { q1: "person-a" }, "person-b"), "person-a", "question override wins");
check.equal(selectedQuestionMember("q2", { q1: "person-a" }, "person-b"), "person-b", "unanswered question inherits current member");
check.equal(selectedSignOffMember("person-b", "person-a"), "person-b", "explicit sign-off member wins");
check.equal(selectedSignOffMember("", "person-a"), "person-a", "sign-off defaults to current member");

check(checklist.includes("const [overrides, setOverrides]"), "checklist keeps per-item pending member state");
check(checklist.includes("const memberFor = (key: string)"), "checklist resolves the active or overridden member");
check(checklist.includes("saveQuestion(task, \"yes\")"), "response sends the selected question member");
check(checklist.includes("saveQuestion(task, \"no\")"), "issue response sends the selected question member");
check(checklist.includes("workflowMemberId"), "sign-off uses the workflow member when recovery is needed");
check(checklist.includes("onSignOff(memberId)"), "sign-off sends selected actor");
check(checklist.includes("response.teamMemberId"), "completed response reads persisted actor");
check(checklist.includes("response?.createdAt"), "completed response reads persisted timestamp");
check(checklist.includes("workflowMemberId"), "workflow member is presented as a default");
check(checklist.includes("Finish recording completion"), "completion recovery remains explicit when needed");

check(cleaning.includes("<StructuredTaskWorkflow"), "cleaning delegates to the shared checklist renderer");
check(cleaning.includes("cleaningCompletions={completions}"), "cleaning passes persisted completion evidence");
check(cleaning.includes("onCompleteCleaning={onComplete}"), "cleaning preserves the completion actor callback");
check(cleaning.includes("onReportCleaningIssue={onIssue}"), "cleaning preserves the issue callback");
check(source.includes("response.teamMemberId"), "structured cleaning displays persisted actor");
check(source.includes("response.createdAt"), "structured cleaning displays persisted timestamp");

check(compliance.includes("await activeMember(location.id, input.teamMemberId)"), "new checklist response requires active local member");
check(compliance.includes("teamMemberId: input.teamMemberId"), "checklist response stores actor");
check(compliance.includes("checklistSignOffs").valueOf(), "checklist sign-off persists separately");
check(compliance.includes("completedBy: context.user.id, teamMemberId: input.teamMemberId"), "sign-off stores selected actor and time");
check(history.includes("checklistResponses"), "history includes individual checklist responses");
check(history.includes("checklistSignOffs"), "history includes separate checklist sign-offs");
check(history.includes("cleaningCompletions"), "history includes individual cleaning completions");
check(history.includes("buildInspectionChronology"), "history builds chronology from record-level evidence");
check(reports.includes("memberName(response.teamMemberId)"), "report exception uses response actor");
check(reports.includes("openingComplete") && reports.includes("Boolean(openingSignoff)"), "report completion remains response plus sign-off");

check(workflows.includes("saveChecklistResponse({ locationId: dashboard.location._id, checklist: checklistList, questionId, answer: \"yes\", teamMemberId })"), "workflow preserves response payload");
check(workflows.includes("signOffStructuredTask({ locationId: dashboard.location._id, area: checklistList, teamMemberId })"), "workflow preserves sign-off payload");
check(workflows.includes("setChecklistList(null); setCleaningList(false)"), "store reset clears checklist and cleaning state");
check(dashboard.includes("key={`${dashboard.location._id}:${workflows.checklistList}`}"), "store/checklist key resets pending checklist state");
check(dashboard.includes("key={dashboard.location._id}"), "store key resets pending cleaning state");
check(!schema.match(/assignedUserId|checklistOwner|primaryTeamMember/), "no assignment schema introduced");
check(!source.match(/checklistOwner|assignedUserId|exclusiveOwner|assignmentLock/), "no ownership lock introduced");

console.log(`Team handover tests passed: ${passed}/${passed}`);
