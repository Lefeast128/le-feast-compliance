import { internalQuery } from "./_generated/server";
import type { TableNames } from "./_generated/dataModel";
import { v } from "convex/values";
import type { GenericId } from "convex/values";

const APPLICATION_TABLES = [
  "users",
  "organisations",
  "locations",
  "memberships",
  "teamMembers",
  "scheduledTasks",
  "equipment",
  "temperatureRounds",
  "temperatureReadings",
  "probeProducts",
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
  "trainingDocumentVersions",
  "trainingCompletions",
  "additionalRequirements",
  "additionalCompletions",
  "rechecks",
  "issues",
  "issueUpdates",
  "auditEvents",
] as const;

const AUTH_TABLES = [
  "authSessions",
  "authAccounts",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
] as const;

const ALL_TABLES = new Set<string>([...APPLICATION_TABLES, ...AUTH_TABLES]);
const STORAGE_FIELDS: Record<string, string[]> = {
  trainingRequirements: ["documentStorageId"],
  trainingDocumentVersions: ["storageId"],
  additionalCompletions: ["documentStorageId"],
};

const AUTH_SAFE_FIELDS: Record<string, string[]> = {
  authAccounts: [
    "_id",
    "_creationTime",
    "userId",
    "provider",
    "providerAccountId",
    "emailVerified",
    "phoneVerified",
  ],
};

function redactAuthRecord(table: string, record: Record<string, unknown>) {
  if (table === "authAccounts") {
    const allowed = AUTH_SAFE_FIELDS.authAccounts;
    return Object.fromEntries(
      allowed
        .filter((field) => field in record)
        .map((field) => [field, record[field]]),
    );
  }

  return {
    _id: record._id,
    _creationTime: record._creationTime,
  };
}

export const page = internalQuery({
  args: {
    table: v.string(),
    cursor: v.optional(v.string()),
    numItems: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!ALL_TABLES.has(args.table)) {
      throw new Error("Unsupported migration baseline table");
    }

    const numItems = Math.min(Math.max(args.numItems ?? 250, 1), 500);
    const result = await ctx.db
      .query(args.table as TableNames)
      .paginate({ cursor: args.cursor ?? null, numItems });

    const page = result.page.map((record) =>
      AUTH_TABLES.includes(args.table as (typeof AUTH_TABLES)[number])
        ? redactAuthRecord(args.table, record as Record<string, unknown>)
        : record,
    );

    const storageReferences = [];
    for (const record of result.page as Record<string, unknown>[]) {
      for (const field of STORAGE_FIELDS[args.table] ?? []) {
        const storageId = record[field];
        if (typeof storageId !== "string") continue;

        const metadata = await ctx.storage.getMetadata(
          storageId as GenericId<"_storage">,
        );
        storageReferences.push({
          table: args.table,
          recordId: record._id,
          field,
          storageId,
          documentName: record.documentName,
          metadata,
          exists: metadata !== null,
        });
      }
    }

    return {
      table: args.table,
      page,
      storageReferences,
      continueCursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
