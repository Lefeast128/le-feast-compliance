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

check(checklist.includes("questionMemberOverrides"), "checklist keeps per-question pending member state");
check(checklist.includes("selectedQuestionMember"), "checklist uses question member selection helper");
check(checklist.includes("onComplete(question._id, questionMemberId)"), "response sends actual question member");
check(checklist.includes("onIssue(issueQuestion._id, problem, action, memberId)"), "issue sends actual question member");
check(checklist.includes("selectedSignOffMember(signOffTeamMemberId, workflowTeamMemberId)"), "sign-off has separate actor selection");
check(checklist.includes("onSignOff(memberId)"), "sign-off sends selected actor");
check(checklist.includes("response.teamMemberId"), "completed response reads persisted actor");
check(checklist.includes("response?.createdAt"), "completed response reads persisted timestamp");
check(checklist.includes("Current team member"), "workflow member is presented as a default");
check(checklist.includes("Signed off by"), "sign-off is presented separately");

check(cleaning.includes("selected[task._id]"), "cleaning selection is keyed per task");
check(cleaning.includes("onComplete(task._id, selected[task._id])"), "cleaning sends task actor");
check(cleaning.includes("completion.teamMemberName"), "cleaning displays persisted actor");
check(cleaning.includes("completion.completedAt"), "cleaning displays persisted timestamp");
check(!cleaning.includes("setSelected((current) => ({ ...current, [task._id]: \"\""), "completed cleaning has no reassignment path");

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
check(workflows.includes("signOffChecklist({ locationId: dashboard.location._id, checklist: checklistList, teamMemberId })"), "workflow preserves sign-off payload");
check(workflows.includes("setChecklistList(null); setCleaningList(false)"), "store reset clears checklist and cleaning state");
check(dashboard.includes("key={`${dashboard.location._id}:${workflows.checklistList}`}"), "store/checklist key resets pending checklist state");
check(dashboard.includes("key={dashboard.location._id}"), "store key resets pending cleaning state");
check(!schema.match(/assignedUserId|checklistOwner|primaryTeamMember/), "no assignment schema introduced");
check(!source.match(/checklistOwner|assignedUserId|exclusiveOwner|assignmentLock/), "no ownership lock introduced");

console.log(`Team handover tests passed: ${passed}/${passed}`);
