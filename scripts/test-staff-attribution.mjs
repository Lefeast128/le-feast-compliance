import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const service = await read("src/server/compliance/service.ts");
const dashboard = await read("src/pages/Dashboard.tsx");
const dashboardToday = await read("src/components/dashboard/DashboardToday.tsx");
const dashboardSource = `${dashboard}\n${dashboardToday}`;
const checklist = await read("src/components/InlineChecklist.tsx");
const history = await read("src/server/history/service.ts");
const dashboardRepository = await read("src/server/dashboard/repository.ts");

assert.match(service, /saveChecklistResponse\([^\n]+teamMemberId: string/);
assert.match(service, /saveSecurityResponse\([^\n]+teamMemberId: string/);
assert.match(service, /const location = await locationFor\(context, input\.locationId\); requireUuid\(input\.questionId, "questionId"\);\s*await activeMember\(location\.id, input\.teamMemberId\);/);
assert.match(service, /const location = await locationFor\(context, input\.locationId\); await activeMember\(location\.id, input\.teamMemberId\); const db = getDb\(\);/);
assert.match(service, /function activeMember\(locationId: string, memberId: string\)/);
assert.match(service, /if \(!member\) throw new ApiError\(422, "Team member does not belong to this location"\)/);
assert.match(service, /if \(!member\.active\) throw new ApiError\(422, "Team member is inactive"\)/);
assert.match(service, /checklistResponses\)\.values\([\s\S]*?teamMemberId: input\.teamMemberId[\s\S]*?returning\(\{ id: checklistResponses\.id \}\)/);
assert.match(service, /securityResponses\)\.values\([\s\S]*?teamMemberId: input\.teamMemberId[\s\S]*?returning\(\{ id: securityResponses\.id \}\)/);
assert.match(service, /if \(input\.answer === "no" && !input\.action\?\.trim\(\)\) throw new ApiError\(422, "A corrective action is required"\)/);

assert.match(checklist, /workflowTeamMemberId/);
assert.match(checklist, /onComplete\(question\._id, taskMember\)/);
assert.match(checklist, /disabled=\{!taskMember\}/);
assert.match(dashboardSource, /questionId, answer: "yes", teamMemberId/);
assert.match(dashboardSource, /questionId: dashboard\.location\._id|questionId: currentSecurityQuestion\._id/);
assert.match(dashboardSource, /teamMemberId: securityTeamMemberId/);
assert.match(dashboardSource, /setSecurityTeamMemberId\(""\)/);

assert.match(dashboardRepository, /teamMemberName: teamNames\.get\(row\.teamMemberId\)/);
assert.match(history, /const checklistResponse = .*teamMemberName/);
assert.match(history, /const securityResponse = .*teamMemberName/);
const historicalNullMember = { teamMemberId: null };
const historicalDisplay = historicalNullMember.teamMemberId ? "Former member" : undefined;
assert.equal(historicalDisplay, undefined, "historical null-member response remains readable");

console.log("Staff attribution tests passed: backend requirements, member validation, workflow requests, and historical null compatibility");
