import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildBaseline } from "./migration-baseline/baseline.mjs";
import { ALL_TABLES } from "./migration-baseline/constants.mjs";

const baselineQuerySource = readFileSync(
  resolve("src/convex/migrationBaseline.ts"),
  "utf8",
);
assert.match(baselineQuerySource, /internalQuery/);
assert.doesNotMatch(
  baselineQuerySource,
  /ctx\.db\.(insert|patch|replace|delete)/,
);
assert.doesNotMatch(
  baselineQuerySource,
  /ctx\.storage\.(store|delete|generateUploadUrl)/,
);

const records = Object.fromEntries(ALL_TABLES.map((table) => [table, []]));
records.users = [
  {
    _id: "user-1",
    _creationTime: 10,
    email: "admin@example.test",
    emailVerificationTime: 11,
    role: "admin",
  },
];
records.organisations = [
  { _id: "org-1", _creationTime: 1, name: "Org", timezone: "Europe/London" },
];
records.locations = [
  {
    _id: "location-1",
    _creationTime: 2,
    organisationId: "org-1",
    name: "Blackpool",
  },
];
records.memberships = [
  {
    _id: "membership-1",
    _creationTime: 3,
    userId: "user-1",
    locationId: "location-1",
    role: "admin",
  },
];
records.teamMembers = [
  { _id: "member-1", _creationTime: 4, locationId: "location-1", active: true },
];
records.temperatureRounds = [
  {
    _id: "round-1",
    _creationTime: 5,
    locationId: "location-1",
    createdBy: "user-1",
  },
];
records.temperatureReadings = [
  {
    _id: "reading-1",
    _creationTime: 6,
    roundId: "round-1",
    locationId: "location-1",
    createdBy: "user-1",
    teamMemberId: "member-1",
  },
];
records.issues = [
  {
    _id: "issue-1",
    _creationTime: 7,
    locationId: "location-1",
    createdBy: "user-1",
  },
];
records.issueUpdates = [
  {
    _id: "update-1",
    _creationTime: 8,
    issueId: "issue-1",
    locationId: "location-1",
    createdBy: "user-1",
  },
];
records.rechecks = [
  {
    _id: "recheck-1",
    _creationTime: 9,
    issueId: "issue-1",
    locationId: "location-1",
    createdBy: "user-1",
  },
];
records.probeProducts = [
  {
    _id: "probe-1",
    _creationTime: 12,
    locationIds: ["location-1"],
    versionRootId: "missing-probe-root",
  },
];
records.trainingRequirements = [
  {
    _id: "training-1",
    _creationTime: 13,
    locationId: "location-1",
    currentDocumentVersionId: "version-1",
  },
];
records.trainingDocumentVersions = [
  {
    _id: "version-1",
    _creationTime: 14,
    requirementId: "training-1",
    storageId: "storage-1",
  },
];
records.trainingCompletions = [
  {
    _id: "completion-1",
    _creationTime: 15,
    locationId: "location-1",
    requirementId: "training-1",
  },
];
records.additionalRequirements = [
  {
    _id: "additional-1",
    _creationTime: 16,
    locationId: "location-1",
    nextDueAt: 100,
  },
];
records.additionalCompletions = [
  {
    _id: "additional-completion-1",
    _creationTime: 17,
    locationId: "location-1",
    requirementId: "additional-1",
    scheduledDueAt: 100,
  },
];
records.auditEvents = [
  {
    _id: "audit-1",
    _creationTime: 18,
    locationId: "location-1",
    userId: "user-1",
    createdAt: 18,
  },
];
records.authAccounts = [
  {
    _id: "account-1",
    _creationTime: 19,
    userId: "user-1",
    provider: "email-otp",
    providerAccountId: "admin@example.test",
    secret: "must-not-export",
  },
];

const baseline = buildBaseline(records, [
  {
    table: "trainingDocumentVersions",
    recordId: "version-1",
    field: "storageId",
    storageId: "storage-1",
    exists: true,
  },
  {
    table: "trainingRequirements",
    recordId: "training-1",
    field: "documentStorageId",
    storageId: "storage-1",
    exists: false,
  },
]);

assert.equal(baseline.readOnly, true);
assert.deepEqual(
  baseline.source.applicationTables,
  ALL_TABLES.filter((table) => !baseline.source.authTables.includes(table)),
);
assert.equal(baseline.tableSummaries.locations.totalRecordCount, 1);
assert.deepEqual(baseline.tableSummaries.teamMembers.recordsPerLocation, {
  "location-1": 1,
});
assert.equal(
  baseline.relationships["temperatureReadings.roundId"].validReferenceCount,
  1,
);
assert.equal(
  baseline.relationships["probeProducts.versionRootId"].missingReferenceCount,
  1,
);
assert.equal(
  baseline.relationships["memberships.userId"].validReferenceCount,
  1,
);
assert.equal(
  baseline.historicalIntegrity.trainingDocumentLinks.currentDocumentVersion
    .valid,
  1,
);
assert.equal(baseline.storageInventory.referenceCount, 2);
assert.equal(baseline.storageInventory.retrievableCount, 1);
assert.equal(baseline.storageInventory.missingCount, 1);
assert.equal(baseline.storageInventory.duplicateStorageIds.length, 1);
assert.equal(baseline.authInventory.users[0].email, "admin@example.test");
assert.equal(baseline.records.authAccounts[0].secret, undefined);
assert.equal(baseline.authInventory.temporaryAdminAccess.preserved, true);

console.log(
  "Migration baseline inventory, relationship, version, storage and auth tests passed",
);
