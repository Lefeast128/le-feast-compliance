import { AUTH_TABLES, APPLICATION_TABLES, ALL_TABLES } from "./constants.mjs";

function redactAuthRecord(table, record) {
  if (table === "authAccounts") {
    const fields = [
      "_id",
      "_creationTime",
      "userId",
      "provider",
      "providerAccountId",
      "emailVerified",
      "phoneVerified",
    ];
    return Object.fromEntries(
      fields
        .filter((field) => field in record)
        .map((field) => [field, record[field]]),
    );
  }
  return { _id: record._id, _creationTime: record._creationTime };
}

const LOCATION_TABLES = [
  "teamMembers",
  "scheduledTasks",
  "equipment",
  "temperatureRounds",
  "temperatureReadings",
  "checklistQuestions",
  "checklistResponses",
  "checklistSignOffs",
  "securityQuestions",
  "securityResponses",
  "securitySignOffs",
  "foodChecks",
  "wastageItems",
  "wastageRecords",
  "catalogueProducts",
  "catalogueSyncStatus",
  "cleaningTasks",
  "cleaningCompletions",
  "trainingRequirements",
  "trainingCompletions",
  "additionalRequirements",
  "additionalCompletions",
  "rechecks",
  "issues",
  "issueUpdates",
  "auditEvents",
];

const VERSIONED_TABLES = [
  "probeProducts",
  "checklistQuestions",
  "securityQuestions",
  "cleaningTasks",
  "trainingRequirements",
  "additionalRequirements",
];

const REFERENCE_SPECS = [
  {
    name: "locations.organisationId",
    source: "locations",
    field: "organisationId",
    target: "organisations",
  },
  {
    name: "memberships.userId",
    source: "memberships",
    field: "userId",
    target: "users",
  },
  {
    name: "memberships.locationId",
    source: "memberships",
    field: "locationId",
    target: "locations",
  },
  {
    name: "probeProducts.locationIds",
    source: "probeProducts",
    field: "locationIds",
    target: "locations",
    array: true,
  },
  {
    name: "temperatureReadings.roundId",
    source: "temperatureReadings",
    field: "roundId",
    target: "temperatureRounds",
  },
  {
    name: "temperatureReadings.equipmentId",
    source: "temperatureReadings",
    field: "equipmentId",
    target: "equipment",
  },
  {
    name: "checklistResponses.questionId",
    source: "checklistResponses",
    field: "questionId",
    target: "checklistQuestions",
  },
  {
    name: "securityResponses.questionId",
    source: "securityResponses",
    field: "questionId",
    target: "securityQuestions",
  },
  {
    name: "trainingDocumentVersions.requirementId",
    source: "trainingDocumentVersions",
    field: "requirementId",
    target: "trainingRequirements",
  },
  {
    name: "trainingCompletions.requirementId",
    source: "trainingCompletions",
    field: "requirementId",
    target: "trainingRequirements",
  },
  {
    name: "trainingCompletions.documentVersionId",
    source: "trainingCompletions",
    field: "documentVersionId",
    target: "trainingDocumentVersions",
    optional: true,
  },
  {
    name: "trainingRequirements.currentDocumentVersionId",
    source: "trainingRequirements",
    field: "currentDocumentVersionId",
    target: "trainingDocumentVersions",
    optional: true,
  },
  {
    name: "trainingRequirements.requiredDocumentVersionId",
    source: "trainingRequirements",
    field: "requiredDocumentVersionId",
    target: "trainingDocumentVersions",
    optional: true,
  },
  {
    name: "additionalCompletions.requirementId",
    source: "additionalCompletions",
    field: "requirementId",
    target: "additionalRequirements",
  },
  {
    name: "rechecks.issueId",
    source: "rechecks",
    field: "issueId",
    target: "issues",
  },
  {
    name: "issueUpdates.issueId",
    source: "issueUpdates",
    field: "issueId",
    target: "issues",
  },
  {
    name: "issues.sourceTemperatureReadingId",
    source: "issues",
    field: "sourceTemperatureReadingId",
    target: "temperatureReadings",
    optional: true,
  },
  {
    name: "issues.sourceFoodCheckId",
    source: "issues",
    field: "sourceFoodCheckId",
    target: "foodChecks",
    optional: true,
  },
  {
    name: "issues.sourceAdditionalCompletionId",
    source: "issues",
    field: "sourceAdditionalCompletionId",
    target: "additionalCompletions",
    optional: true,
  },
  {
    name: "foodChecks.probeProductId",
    source: "foodChecks",
    field: "probeProductId",
    target: "probeProducts",
    optional: true,
  },
];

const USER_REFERENCE_FIELDS = {
  temperatureRounds: ["createdBy"],
  temperatureReadings: ["createdBy"],
  checklistResponses: ["createdBy"],
  checklistSignOffs: ["completedBy"],
  securityResponses: ["createdBy"],
  securitySignOffs: ["completedBy"],
  foodChecks: ["createdBy"],
  wastageRecords: ["createdBy"],
  cleaningCompletions: ["completedBy"],
  trainingDocumentVersions: ["createdBy"],
  trainingCompletions: ["completedBy"],
  additionalCompletions: ["completedBy"],
  issues: ["createdBy", "resolvedBy"],
  issueUpdates: ["createdBy"],
  auditEvents: ["userId"],
};

const TEAM_MEMBER_REFERENCE_TABLES = [
  "temperatureRounds",
  "temperatureReadings",
  "checklistResponses",
  "checklistSignOffs",
  "securityResponses",
  "securitySignOffs",
  "foodChecks",
  "wastageRecords",
  "cleaningCompletions",
  "trainingCompletions",
  "additionalCompletions",
  "rechecks",
  "issues",
  "issueUpdates",
];

const CONFIG_VERSION_ROOT_TABLES = [
  "probeProducts",
  "checklistQuestions",
  "securityQuestions",
  "cleaningTasks",
  "additionalRequirements",
];

function idOf(record) {
  return record?._id;
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function tableMap(records) {
  return new Map(ALL_TABLES.map((table) => [table, records[table] ?? []]));
}

function referenceResult(spec, tables) {
  const sourceRecords = tables.get(spec.source) ?? [];
  const targetIds = new Set((tables.get(spec.target) ?? []).map(idOf));
  const orphanIdentifiers = [];
  let validReferenceCount = 0;
  let missingReferenceCount = 0;

  for (const record of sourceRecords) {
    const value = record[spec.field];
    if (value === undefined || value === null) {
      if (!spec.optional) {
        missingReferenceCount += 1;
        orphanIdentifiers.push({ sourceRecordId: idOf(record), value: null });
      }
      continue;
    }

    const values = spec.array ? value : [value];
    for (const reference of values) {
      if (targetIds.has(reference)) {
        validReferenceCount += 1;
      } else {
        missingReferenceCount += 1;
        orphanIdentifiers.push({
          sourceRecordId: idOf(record),
          value: reference,
        });
      }
    }
  }

  return {
    sourceTable: spec.source,
    sourceField: spec.field,
    targetTable: spec.target,
    validReferenceCount,
    missingReferenceCount,
    orphanIdentifiers,
  };
}

function addGeneratedReferences(specs) {
  for (const table of LOCATION_TABLES) {
    specs.push({
      name: `${table}.locationId`,
      source: table,
      field: "locationId",
      target: "locations",
    });
  }

  for (const [table, fields] of Object.entries(USER_REFERENCE_FIELDS)) {
    for (const field of fields) {
      specs.push({
        name: `${table}.${field}`,
        source: table,
        field,
        target: "users",
        optional: field === "resolvedBy",
      });
    }
  }

  for (const table of TEAM_MEMBER_REFERENCE_TABLES) {
    specs.push({
      name: `${table}.teamMemberId`,
      source: table,
      field: "teamMemberId",
      target: "teamMembers",
      optional: true,
    });
  }

  for (const table of CONFIG_VERSION_ROOT_TABLES) {
    specs.push({
      name: `${table}.versionRootId`,
      source: table,
      field: "versionRootId",
      target: table,
      optional: true,
    });
  }
}

function relationshipResults(tables) {
  const specs = [...REFERENCE_SPECS];
  addGeneratedReferences(specs);
  return Object.fromEntries(
    specs.map((spec) => [spec.name, referenceResult(spec, tables)]),
  );
}

function recordsByLocation(records) {
  const counts = {};
  for (const record of records) {
    if (typeof record.locationId !== "string") continue;
    counts[record.locationId] = (counts[record.locationId] ?? 0) + 1;
  }
  return counts;
}

function tableSummary(table, records) {
  const creationTimes = records
    .map((record) => record._creationTime)
    .filter(finite)
    .sort((a, b) => a - b);

  return {
    table,
    totalRecordCount: records.length,
    recordsPerLocation: recordsByLocation(records),
    earliestCreationTimestamp: creationTimes[0] ?? null,
    latestCreationTimestamp: creationTimes.at(-1) ?? null,
  };
}

function historicalIntegrity(tables) {
  const versionRoots = {};
  for (const table of VERSIONED_TABLES) {
    const records = tables.get(table) ?? [];
    const ids = new Set(records.map(idOf));
    let deactivatedCount = 0;
    let missingVersionRootCount = 0;
    let invalidLifecycleCount = 0;
    const orphanVersionRootIds = [];

    for (const record of records) {
      if (record.active === false) deactivatedCount += 1;
      if (record.versionRootId === undefined) {
        missingVersionRootCount += 1;
      } else if (!ids.has(record.versionRootId)) {
        orphanVersionRootIds.push({
          recordId: idOf(record),
          versionRootId: record.versionRootId,
        });
      }
      if (
        finite(record.deactivatedAt) &&
        finite(record._creationTime) &&
        record.deactivatedAt < record._creationTime
      ) {
        invalidLifecycleCount += 1;
      }
    }

    versionRoots[table] = {
      versionedRecordCount: records.length,
      deactivatedCount,
      missingVersionRootCount,
      orphanVersionRootIds,
      invalidLifecycleCount,
    };
  }

  const requirements = tables.get("trainingRequirements") ?? [];
  const versions = tables.get("trainingDocumentVersions") ?? [];
  const versionById = new Map(versions.map((record) => [record._id, record]));
  const trainingLinks = {
    currentDocumentVersion: { valid: 0, missing: 0, wrongRequirement: [] },
    requiredDocumentVersion: { valid: 0, missing: 0, wrongRequirement: [] },
    orphanDocumentVersions: [],
  };

  for (const requirement of requirements) {
    for (const field of [
      "currentDocumentVersionId",
      "requiredDocumentVersionId",
    ]) {
      const pointer = requirement[field];
      if (pointer === undefined) continue;
      const version = versionById.get(pointer);
      const result =
        trainingLinks[
          field === "currentDocumentVersionId"
            ? "currentDocumentVersion"
            : "requiredDocumentVersion"
        ];
      if (!version) {
        result.missing += 1;
      } else if (version.requirementId !== requirement._id) {
        result.wrongRequirement.push({
          requirementId: requirement._id,
          versionId: pointer,
        });
      } else {
        result.valid += 1;
      }
    }
  }
  const requirementIds = new Set(requirements.map(idOf));
  for (const version of versions) {
    if (!requirementIds.has(version.requirementId)) {
      trainingLinks.orphanDocumentVersions.push({
        versionId: version._id,
        requirementId: version.requirementId,
      });
    }
  }

  const additionalRequirements = tables.get("additionalRequirements") ?? [];
  const additionalCompletions = tables.get("additionalCompletions") ?? [];
  const additionalRequirementIds = new Set(additionalRequirements.map(idOf));
  const additionalDue = {
    invalidRequirementNextDueAt: additionalRequirements
      .filter((record) => !finite(record.nextDueAt))
      .map(idOf),
    invalidCompletionScheduledDueAt: additionalCompletions
      .filter(
        (record) =>
          record.scheduledDueAt !== undefined && !finite(record.scheduledDueAt),
      )
      .map(idOf),
    invalidCompletionNextDueAt: additionalCompletions
      .filter(
        (record) => record.nextDueAt !== undefined && !finite(record.nextDueAt),
      )
      .map(idOf),
    completionRequirementReferenceCount: additionalCompletions.filter(
      (record) => additionalRequirementIds.has(record.requirementId),
    ).length,
  };

  const issues = tables.get("issues") ?? [];
  const issueUpdates = tables.get("issueUpdates") ?? [];
  const rechecks = tables.get("rechecks") ?? [];
  const auditEvents = tables.get("auditEvents") ?? [];
  return {
    versionRoots,
    trainingDocumentLinks: trainingLinks,
    additionalDueRelationships: additionalDue,
    issueHistory: {
      issueCount: issues.length,
      issueUpdateCount: issueUpdates.length,
      recheckCount: rechecks.length,
      issuesWithNoHistory: issues
        .filter(
          (issue) =>
            !issueUpdates.some((update) => update.issueId === issue._id) &&
            !rechecks.some((recheck) => recheck.issueId === issue._id),
        )
        .map(idOf),
    },
    auditHistory: {
      auditEventCount: auditEvents.length,
      eventsWithInvalidTimestamp: auditEvents
        .filter((event) => !finite(event.createdAt))
        .map(idOf),
    },
  };
}

function authInventory(tables) {
  const users = tables.get("users") ?? [];
  const memberships = tables.get("memberships") ?? [];
  return {
    users: users.map((user) => ({
      _id: user._id,
      _creationTime: user._creationTime,
      email: user.email,
      emailVerificationTime: user.emailVerificationTime,
      isAnonymous: user.isAnonymous,
      role: user.role,
    })),
    memberships: memberships.map((membership) => ({
      _id: membership._id,
      _creationTime: membership._creationTime,
      userId: membership.userId,
      locationId: membership.locationId,
      role: membership.role,
    })),
    authManagedTables: Object.fromEntries(
      AUTH_TABLES.map((table) => [
        table,
        {
          recordCount: (tables.get(table) ?? []).length,
          rawSecretsExported: false,
          reusableSessionsExported: false,
        },
      ]),
    ),
    temporaryAdminAccess: {
      mechanism:
        "recovery.temporaryAccessEnabled and recovery.claimTemporaryAccess",
      controlledBy: "ENABLE_TEMP_ADMIN_ACCESS=true",
      anonymousOnly: true,
      grants:
        "admin membership for the first active location when no membership exists",
      preserved: true,
    },
    permissionPaths: {
      staff: "requireLocationAccess for the exact location",
      manager: "requireLocationManager for the exact location",
      admin:
        "requireLocationAdmin for the exact location; operations exposes manager/admin memberships",
      organisationWideAdmin:
        "not currently represented as a separate organisation-wide membership path",
    },
    freebuff: {
      status: "legacy-pending-verification",
      references: ["src/convex/auth.config.ts"],
      issuerEnvironmentVariable: "VLY_CONVEX_AUTH_ISSUER",
      defaultIssuer: "https://freebuff.com",
      jwksPath: "/api/web/.well-known/jwks.json",
      repositoryEvidence:
        "authentication federation configuration only; no compliance business feature depends on Freebuff",
      productionNecessity: "not proven by repository evidence",
      recommendedDisposition: "retire unless production usage is confirmed",
    },
  };
}

export function buildBaseline(records, storageReferences = []) {
  const safeRecords = Object.fromEntries(
    ALL_TABLES.map((table) => [
      table,
      (records[table] ?? []).map((record) =>
        AUTH_TABLES.includes(table) ? redactAuthRecord(table, record) : record,
      ),
    ]),
  );
  const tables = tableMap(safeRecords);
  const tableSummaries = Object.fromEntries(
    ALL_TABLES.map((table) => [
      table,
      tableSummary(table, tables.get(table) ?? []),
    ]),
  );
  const locations = tables.get("locations") ?? [];
  const locationNames = Object.fromEntries(
    locations.map((location) => [location._id, location.name]),
  );

  return {
    format: "le-feast-compliance.convex-migration-baseline.v1",
    generatedAt: new Date().toISOString(),
    readOnly: true,
    source: {
      provider: "Convex",
      applicationTables: APPLICATION_TABLES,
      authTables: AUTH_TABLES,
    },
    safety: {
      readOnly: true,
      mutationsInvoked: [],
      storageWrites: [],
      outputMode: "new-file-only-or-stdout",
    },
    tableSummaries,
    locationNames,
    relationships: relationshipResults(tables),
    historicalIntegrity: historicalIntegrity(tables),
    storageInventory: {
      referenceCount: storageReferences.length,
      retrievableCount: storageReferences.filter(
        (reference) => reference.exists,
      ).length,
      missingCount: storageReferences.filter((reference) => !reference.exists)
        .length,
      duplicateStorageIds: Object.entries(
        storageReferences.reduce((groups, reference) => {
          groups[reference.storageId] ??= [];
          groups[reference.storageId].push({
            table: reference.table,
            recordId: reference.recordId,
            field: reference.field,
            documentName: reference.documentName,
          });
          return groups;
        }, {}),
      )
        .filter(([, references]) => references.length > 1)
        .map(([storageId, references]) => ({ storageId, references })),
      references: storageReferences,
    },
    authInventory: authInventory(tables),
    environmentInventory: {
      convex: ["VITE_CONVEX_URL", "CONVEX_SITE_URL", "CONVEX_DEPLOYMENT"],
      auth: ["VLY_CONVEX_AUTH_ISSUER", "ENABLE_TEMP_ADMIN_ACCESS"],
      email: ["RESEND_API_KEY", "AUTH_FROM_EMAIL"],
      touchOffice: [
        "TOUCHOFFICE_CATALOG_ENDPOINT_URL",
        "TOUCHOFFICE_CATALOG_API_SECRET",
      ],
      platform: ["VLY_INTEGRATION_KEY"],
      valuesExported: false,
    },
    records: safeRecords,
  };
}

export { ALL_TABLES, APPLICATION_TABLES, AUTH_TABLES };
