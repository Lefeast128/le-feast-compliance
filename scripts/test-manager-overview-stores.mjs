import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildManagerOverviewActions, buildManagerOverviewStoreSummary } from "../src/lib/manager-overview.ts";
import { managerOverviewLocationScope, summarizeStoresIndependently } from "../src/server/reviews/all-stores-service.ts";

const orgA = "11111111-1111-4111-8111-111111111111";
const storeA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const storeB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const context = (role, memberships = [], organisationId = orgA) => ({ user: { id: "user", role, organisationId }, memberships });

assert.deepEqual(managerOverviewLocationScope(context("admin")), { kind: "organisation", organisationId: orgA });
assert.deepEqual(managerOverviewLocationScope(context("user", [
  { locationId: storeA, role: "manager" },
  { locationId: storeA, role: "manager" },
  { locationId: storeB, role: "staff" },
])), { kind: "locations", locationIds: [storeA] });
assert.throws(() => managerOverviewLocationScope(context("user", [{ locationId: storeA, role: "staff" }])), error => error.status === 403);
assert.throws(() => managerOverviewLocationScope(context("admin", [], null)), error => error.status === 403);

const centre = {
  required: [
    { id: "am", taskId: "am-temperature", label: "AM temperatures", status: "due_now", detail: "Due", requiresAttention: true },
    { id: "pm", taskId: "pm-temperature", label: "PM temperatures", status: "pending_today", detail: "Later", requiresAttention: false },
    { id: "opening", taskId: "opening-checklist", label: "Opening checklist", status: "in_progress", detail: "Issue reported", requiresAttention: true },
  ],
  failedTemperatures: 0,
  unresolvedIssues: 2,
  cleaning: { due: 3, complete: 1, incomplete: 2, incompleteTaskIds: ["c1", "c2"], issueReported: 0, afterUse: 0, afterUseComplete: 0 },
  additional: { due: 0, complete: 0, incomplete: 0, overdue: 0, issueReported: 0 },
  issueLinkedTaskIds: ["opening-checklist"],
};
const input = {
  now: Date.parse("2026-11-03T12:00:00Z"), timezone: "Europe/London", centre,
  issues: [{ id: "issue-1", title: "Open issue", status: "open" }, { id: "issue-2", title: "Monitoring issue", status: "monitoring" }, { id: "resolved", title: "Resolved", status: "resolved" }],
  cleaningTasks: [{ _id: "c1", title: "Cleaning 1" }, { _id: "c2", title: "Cleaning 2" }],
  additionalRequirements: [], additionalCompletions: [],
  weekly: { status: "due" }, fourWeekly: { status: "up_to_date" },
};
assert.deepEqual(buildManagerOverviewStoreSummary(input), {
  checksOutstanding: 1,
  unresolvedIssues: 2,
  cleaningOutstanding: 2,
  reviewsDue: 1,
  dueLater: 1,
});

const boundaryInput = {
  ...input,
  now: Date.parse("2026-11-03T23:45:00Z"),
  centre: { ...centre, required: [], cleaning: { due: 0, complete: 0, incomplete: 0, incompleteTaskIds: [], issueReported: 0, afterUse: 0, afterUseComplete: 0 }, additional: { due: 1, complete: 0, incomplete: 1, overdue: 0, issueReported: 0 } },
  issues: [], cleaningTasks: [], weekly: { status: "up_to_date" },
  additionalRequirements: [{ _id: "boundary", title: "Timezone boundary", nextDueAt: "2026-11-04T00:30:00.000Z" }],
};
assert.equal(buildManagerOverviewActions(boundaryInput).actions.some(action => action.id === "additional:boundary"), false);
assert.equal(buildManagerOverviewActions({ ...boundaryInput, now: Date.parse("2026-11-04T01:00:00Z") }).actions.some(action => action.id === "additional:boundary"), true);

const storeRows = [{ id: storeA, name: "Alpha", timezone: "Europe/London" }, { id: storeB, name: "Beta", timezone: "Europe/London" }];
const partial = await summarizeStoresIndependently(storeRows, async store => {
  if (store.id === storeB) throw new Error("unavailable");
  return { checksOutstanding: 2, unresolvedIssues: 1, cleaningOutstanding: 0, reviewsDue: 1, dueLater: 2 };
});
assert.equal(partial[0].state, "ready");
assert.equal(partial[0].summary.checksOutstanding, 2);
assert.equal(partial[1].state, "error");
assert.equal(partial[1].summary, null);

const source = await readFile(new URL("../src/components/ManagerReviews.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const service = await readFile(new URL("../src/server/reviews/all-stores-service.ts", import.meta.url), "utf8");
assert.match(source, /aria-label="Store summaries"/);
assert.match(source, /grid-cols-2 gap-2 sm:grid-cols-4/);
assert.match(source, /Summary unavailable for this store/);
assert.match(source, /Open Manager Overview/);
assert.match(dashboard, /getRoleCapabilities\(user, memberships, nextLocationId\)\.canViewManagerReviews/);
assert.match(dashboard, /managerReturnToAllStores/);
assert.match(service, /eq\(locations\.organisationId, context\.user\.organisationId!/);
assert.match(service, /requireLocationManager\(context, location\.id, location\.organisationId\)/);
console.log("All-store policy, calculation parity, timezone, partial-failure and navigation checks passed (policy/unit and source assertions; no authenticated DB integration).");
