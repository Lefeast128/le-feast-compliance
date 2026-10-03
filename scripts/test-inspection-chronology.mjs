import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildInspectionChronology, carriedOpenIssues } from "../src/server/history/chronology.ts";
import { dateKeyFrom, dateFromKey, formatDateKey } from "../src/lib/date-key.ts";

const dayStart = new Date("2026-07-15T00:00:00.000Z");
const dayEnd = new Date("2026-07-15T23:59:59.999Z");
const member = { teamMemberId: "member-1", teamMemberName: "James" };

const chronology = buildInspectionChronology({
  dayStart,
  dayEnd,
  rounds: [{ id: "round-1", session: "AM", startedAt: "2026-07-15T08:00:00.000Z", completedAt: "2026-07-15T08:20:00.000Z", ...member }],
  readings: [{ id: "reading-1", roundId: "round-1", equipmentName: "Walk-in fridge", temperature: 4.3, result: "normal", createdAt: "2026-07-15T08:14:00.000Z", ...member }],
  probes: [{ id: "probe-1", product: "Chicken Brioche", quantity: "2", temperature: 74, minimumTemperature: 76, holdMinutes: 2, result: "fail", createdAt: "2026-07-15T09:02:00.000Z", ...member }],
  checklistResponses: [{ id: "check-1", checklist: "opening", question: "Handwash soap available?", answer: "yes", createdAt: "2026-07-15T08:26:00.000Z", ...member }],
  checklistSignoffs: [{ id: "check-signoff-1", checklist: "opening", completedAt: "2026-07-15T08:30:00.000Z", ...member }],
  securityResponses: [{ id: "security-1", session: "AM", question: "Back door secure?", answer: "yes", createdAt: "2026-07-15T08:35:00.000Z", ...member }],
  securitySignoffs: [{ id: "security-signoff-1", session: "AM", completedAt: "2026-07-15T08:40:00.000Z", ...member }],
  cleaning: [{ id: "clean-1", taskName: "Sanitise prep bench", completedAt: "2026-07-15T10:00:00.000Z", ...member }],
  wastage: [{ id: "waste-1", itemName: "Chicken Brioche", quantity: "1", cataloguePlu: 1234, categorySnapshot: "Prepared Food", notes: "Damaged pack", createdAt: "2026-07-15T10:10:00.000Z", ...member }],
  additional: [{ id: "additional-1", requirementTitle: "Pest control check", answers: { check: "yes" }, certificateReference: "CERT-1", documentUrl: "/api/documents/document-1", completedAt: "2026-07-15T10:20:00.000Z", ...member }],
  issues: [
    { id: "issue-1", title: "Low temperature", description: "Fridge low", status: "resolved", createdAt: "2026-07-15T09:03:00.000Z", resolvedAt: "2026-07-15T09:11:00.000Z", resolutionNote: "Passed recheck", ...member },
    { id: "issue-carried", title: "Open carry-over", description: "Still open", status: "monitoring", createdAt: "2026-07-14T16:00:00.000Z", resolvedAt: null, ...member },
    { id: "issue-old", title: "Old resolved", description: "Done", status: "resolved", createdAt: "2026-07-14T08:00:00.000Z", resolvedAt: "2026-07-14T12:00:00.000Z", ...member },
  ],
  issueUpdates: [{ id: "update-1", issueId: "issue-1", updateType: "action", note: "Continue cooking", status: "monitoring", createdAt: "2026-07-15T09:05:00.000Z", ...member }],
  rechecks: [{ id: "recheck-1", issueId: "issue-1", temperature: 78, result: "pass", createdAt: "2026-07-15T09:10:00.000Z", ...member }],
});

assert.ok(chronology.length > 0, "chronology contains real activity");
assert.deepEqual(chronology.map(event => event.occurredAt), [...chronology].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).map(event => event.occurredAt), "chronology is oldest first");
assert.equal(new Set(chronology.map(event => event.id)).size, chronology.length, "event ids are unique");
assert.equal(chronology.find(event => event.eventType === "temperature_reading").detail, "Walk-in fridge · 4.3°C");
assert.equal(chronology.find(event => event.eventType === "temperature_reading").teamMemberName, "James");
assert.match(chronology.find(event => event.eventType === "food_probe").detail, /Chicken Brioche/);
assert.match(chronology.find(event => event.eventType === "checklist_response").detail, /Handwash soap available\?/);
assert.match(chronology.find(event => event.eventType === "security_response").detail, /Back door secure\?/);
assert.equal(chronology.find(event => event.eventType === "cleaning").detail, "Sanitise prep bench");
assert.match(chronology.find(event => event.eventType === "wastage").detail, /Chicken Brioche/);
assert.match(chronology.find(event => event.eventType === "additional_check").detail, /check: yes/);
const lifecycle = chronology.filter(event => event.relatedIssueId === "issue-1").map(event => event.eventType);
assert.deepEqual(lifecycle, ["issue_created", "issue_update", "issue_recheck", "issue_resolved"], "issue lifecycle is ordered");
assert.equal(carriedOpenIssues([{ id: "carry", title: "Carry", status: "open", createdAt: "2026-07-14T16:00:00Z", resolvedAt: null, teamMemberName: "James" }], dayStart).length, 1);
assert.equal(carriedOpenIssues([{ id: "resolved", title: "Resolved", status: "resolved", createdAt: "2026-07-14T16:00:00Z", resolvedAt: "2026-07-14T17:00:00Z" }], dayStart).length, 0);
assert.equal(chronology.some(event => event.teamMemberName === null), true, "missing attribution remains missing");
assert.doesNotMatch(JSON.stringify(chronology), /storageId|documentStorageId|pathname/);

assert.equal(dateKeyFrom(new Date(2026, 0, 15, 0, 0)), "2026-01-15", "GMT date key remains exact");
assert.equal(dateKeyFrom(new Date(2026, 6, 15, 0, 0)), "2026-07-15", "BST date key remains exact");
assert.equal(formatDateKey(dateFromKey("2026-07-15")), "2026-07-15", "date key round-trip remains exact");

const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
assert.doesNotMatch(dashboard, /additionalHistory|additional\.history/);
assert.match(dashboard, /setSelectedDay\(date\)/);
const archiveRoute = await readFile(new URL("../api/archive.ts", import.meta.url), "utf8");
assert.match(archiveRoute, /archive\(context/);
const service = await readFile(new URL("../src/server/history/service.ts", import.meta.url), "utf8");
assert.match(service, /requireLocationAccess/);

console.log("Inspection chronology tests passed: 20");
