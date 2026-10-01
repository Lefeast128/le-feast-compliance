import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = (name = "created_at") => timestamp(name, { withTimezone: true }).defaultNow().notNull();
const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });
const foreignId = (name: string) => uuid(name).notNull();

export const userRole = pgEnum("user_role", ["user", "admin"]);
export const membershipRole = pgEnum("membership_role", ["staff", "manager"]);
export const temperatureSession = pgEnum("temperature_session", ["AM", "PM"]);
export const temperatureResult = pgEnum("temperature_result", ["normal", "within_limit", "fail"]);
export const checklistKind = pgEnum("checklist_kind", ["opening", "closing"]);
export const issueStatus = pgEnum("issue_status", ["open", "monitoring", "resolved"]);

export const organisations = pgTable("organisations", {
  id: id(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/London"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  organisationId: uuid("organisation_id"),
  email: text("email").notNull(),
  name: text("name"),
  role: userRole("role").notNull().default("user"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: createdAt(),
});

export const locations = pgTable("locations", {
  id: id(), organisationId: foreignId("organisation_id"), name: text("name").notNull(),
  shortName: text("short_name").notNull(), timezone: text("timezone").notNull().default("Europe/London"),
  active: boolean("active").notNull().default(true), createdAt: createdAt(),
});

export const memberships = pgTable("memberships", {
  id: id(), userId: foreignId("user_id"), locationId: foreignId("location_id"),
  role: membershipRole("role").notNull(), createdAt: createdAt(),
}, table => ({ userLocation: uniqueIndex("memberships_user_location_idx").on(table.userId, table.locationId) }));

export const teamMembers = pgTable("team_members", {
  id: id(), locationId: foreignId("location_id"), name: text("name").notNull(),
  role: text("role").notNull().default("team"), active: boolean("active").notNull().default(true), createdAt: createdAt(),
});

export const scheduledTasks = pgTable("scheduled_tasks", {
  id: id(), locationId: foreignId("location_id"), title: text("title").notNull(), kind: text("kind").notNull(),
  session: text("session"), dueLabel: text("due_label").notNull(), status: text("status").notNull(),
  completedAt: timestampColumn("completed_at"), completedBy: uuid("completed_by"), createdAt: createdAt(),
});

export const equipment = pgTable("equipment", {
  id: id(), locationId: foreignId("location_id"), name: text("name").notNull(), type: text("type").notNull(),
  preferredTemperature: integer("preferred_temperature"), maximumTemperature: integer("maximum_temperature"), order: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), createdAt: createdAt(),
});

export const temperatureRounds = pgTable("temperature_rounds", {
  id: id(), locationId: foreignId("location_id"), session: temperatureSession("session").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(), completedAt: timestampColumn("completed_at"),
  createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"), createdAt: createdAt(),
});

export const temperatureReadings = pgTable("temperature_readings", {
  id: id(), roundId: foreignId("round_id"), equipmentId: foreignId("equipment_id"), locationId: foreignId("location_id"),
  temperature: integer("temperature").notNull(), result: temperatureResult("result").notNull(), createdAt: createdAt(), createdBy: foreignId("created_by"),
  teamMemberId: uuid("team_member_id"), voided: boolean("voided").notNull().default(false), equipmentName: text("equipment_name"),
  preferredTemperature: integer("preferred_temperature"), maximumTemperature: integer("maximum_temperature"),
});

export const probeProducts = pgTable("probe_products", {
  id: id(), organisationId: foreignId("organisation_id"), name: text("name").notNull(), minimumTemperature: integer("minimum_temperature").notNull(),
  holdMinutes: integer("hold_minutes").notNull(), locationIds: jsonb("location_ids").$type<string[]>().notNull(), order: integer("sort_order"),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
});

export const checklistQuestions = pgTable("checklist_questions", {
  id: id(), locationId: foreignId("location_id"), checklist: checklistKind("checklist").notNull(), question: text("question").notNull(), order: integer("sort_order").notNull(),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
});
export const checklistResponses = pgTable("checklist_responses", {
  id: id(), locationId: foreignId("location_id"), checklist: checklistKind("checklist").notNull(), questionId: foreignId("question_id"), answer: text("answer").notNull(),
  problem: text("problem"), action: text("action"), createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"),
});
export const checklistSignOffs = pgTable("checklist_sign_offs", {
  id: id(), locationId: foreignId("location_id"), checklist: checklistKind("checklist").notNull(), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: foreignId("completed_by"), teamMemberId: foreignId("team_member_id"),
}, table => ({ day: uniqueIndex("checklist_sign_offs_day_idx").on(table.locationId, table.checklist, table.dateKey) }));

export const securityQuestions = pgTable("security_questions", {
  id: id(), locationId: foreignId("location_id"), session: temperatureSession("session").notNull(), question: text("question").notNull(), order: integer("sort_order").notNull(),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
});
export const securityResponses = pgTable("security_responses", {
  id: id(), locationId: foreignId("location_id"), session: temperatureSession("session").notNull(), questionId: foreignId("question_id"), answer: text("answer").notNull(), issue: text("issue"),
  createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"),
});
export const securitySignOffs = pgTable("security_sign_offs", {
  id: id(), locationId: foreignId("location_id"), session: temperatureSession("session").notNull(), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: foreignId("completed_by"), teamMemberId: foreignId("team_member_id"),
}, table => ({ day: uniqueIndex("security_sign_offs_day_idx").on(table.locationId, table.session, table.dateKey) }));

export const foodChecks = pgTable("food_checks", {
  id: id(), locationId: foreignId("location_id"), product: text("product").notNull(), quantity: text("quantity"), temperature: integer("temperature").notNull(), result: text("result").notNull(), action: text("action"),
  createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"), probeProductId: uuid("probe_product_id"), minimumTemperature: integer("minimum_temperature"), holdMinutes: integer("hold_minutes"),
});
export const wastageItems = pgTable("wastage_items", { id: id(), locationId: foreignId("location_id"), name: text("name").notNull(), active: boolean("active").notNull().default(true), order: integer("sort_order").notNull().default(0), createdAt: createdAt() });
export const wastageRecords = pgTable("wastage_records", {
  id: id(), locationId: foreignId("location_id"), itemId: uuid("item_id"), itemName: text("item_name"), quantity: text("quantity"), notes: text("notes"), noWaste: boolean("no_waste").notNull().default(false), createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"),
});
export const catalogueProducts = pgTable("catalogue_products", {
  id: id(), locationId: foreignId("location_id"), siteId: text("site_id").notNull(), plu: integer("plu").notNull(), name: text("name").notNull(), department: text("department"), group: text("product_group"), valueSources: jsonb("value_sources"), active: boolean("active").notNull().default(true), needsCategoryReview: boolean("needs_category_review").notNull().default(true), firstSeenAt: createdAt("first_seen_at"), lastSeenAt: createdAt("last_seen_at"), lastSuccessfulSyncAt: createdAt("last_successful_sync_at"),
}, table => ({ locationPlu: uniqueIndex("catalogue_products_location_plu_idx").on(table.locationId, table.plu) }));
export const catalogueSyncStatus = pgTable("catalogue_sync_status", { id: id(), locationId: foreignId("location_id"), lastSuccessfulSyncAt: timestampColumn("last_successful_sync_at"), lastAttemptedSyncAt: createdAt("last_attempted_sync_at"), lastError: text("last_error"), productCount: integer("product_count"), addedCount: integer("added_count"), renamedCount: integer("renamed_count"), removedCount: integer("removed_count") }, table => ({ location: uniqueIndex("catalogue_sync_status_location_idx").on(table.locationId) }));

export const cleaningTasks = pgTable("cleaning_tasks", { id: id(), locationId: foreignId("location_id"), name: text("name").notNull(), frequency: text("frequency").notNull(), weekdays: jsonb("weekdays").$type<number[]>().notNull(), active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), order: integer("sort_order").notNull().default(0), createdAt: createdAt() });
export const cleaningCompletions = pgTable("cleaning_completions", { id: id(), locationId: foreignId("location_id"), taskId: foreignId("task_id"), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: foreignId("completed_by"), teamMemberId: uuid("team_member_id") });

export const trainingRequirements = pgTable("training_requirements", { id: id(), locationId: foreignId("location_id"), title: text("title").notNull(), active: boolean("active").notNull().default(true), order: integer("sort_order").notNull().default(0), documentStorageId: text("document_storage_id"), documentName: text("document_name"), currentDocumentVersionId: uuid("current_document_version_id"), requiredDocumentVersionId: uuid("required_document_version_id"), description: text("description"), category: text("category"), audience: text("audience"), selectedTeamMemberIds: jsonb("selected_team_member_ids").$type<string[]>() , createdAt: createdAt() });
export const trainingDocumentVersions = pgTable("training_document_versions", { id: id(), requirementId: foreignId("requirement_id"), versionNumber: integer("version_number").notNull(), storageId: text("storage_id").notNull(), documentName: text("document_name").notNull(), createdAt: createdAt(), createdBy: foreignId("created_by"), requiresReacknowledgement: boolean("requires_reacknowledgement") });
export const trainingCompletions = pgTable("training_completions", { id: id(), locationId: foreignId("location_id"), requirementId: foreignId("requirement_id"), teamMemberId: foreignId("team_member_id"), documentVersionId: uuid("document_version_id"), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: foreignId("completed_by") });

export const additionalRequirements = pgTable("additional_requirements", { id: id(), locationId: foreignId("location_id"), title: text("title").notNull(), description: text("description"), frequency: text("frequency").notNull(), interval: integer("interval"), nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(), fields: jsonb("fields").notNull(), active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), order: integer("sort_order").notNull().default(0), createdAt: createdAt() });
export const additionalCompletions = pgTable("additional_completions", { id: id(), locationId: foreignId("location_id"), requirementId: foreignId("requirement_id"), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), checkedDate: text("checked_date"), nextDueAt: timestamp("next_due_at", { withTimezone: true }), scheduledDueAt: timestamp("scheduled_due_at", { withTimezone: true }), answers: jsonb("answers").notNull(), certificateReference: text("certificate_reference"), documentStorageId: text("document_storage_id"), documentName: text("document_name"), teamMemberId: foreignId("team_member_id"), completedBy: foreignId("completed_by") });

export const issues = pgTable("issues", { id: id(), locationId: foreignId("location_id"), category: text("category").notNull(), title: text("title").notNull(), description: text("description").notNull(), status: issueStatus("status").notNull(), createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id"), action: text("action"), resolvedAt: timestamp("resolved_at", { withTimezone: true }), resolvedBy: uuid("resolved_by"), resolutionNote: text("resolution_note"), originalReading: text("original_reading"), sourceTemperatureReadingId: uuid("source_temperature_reading_id"), sourceFoodCheckId: uuid("source_food_check_id"), sourceAdditionalCompletionId: uuid("source_additional_completion_id") });
export const rechecks = pgTable("rechecks", { id: id(), locationId: foreignId("location_id"), issueId: foreignId("issue_id"), readingId: uuid("reading_id"), temperature: integer("temperature").notNull(), result: text("result").notNull(), createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id") });
export const issueUpdates = pgTable("issue_updates", { id: id(), issueId: foreignId("issue_id"), locationId: foreignId("location_id"), updateType: text("update_type").notNull(), note: text("note").notNull(), status: issueStatus("status").notNull(), createdAt: createdAt(), createdBy: foreignId("created_by"), teamMemberId: uuid("team_member_id") });
export const auditEvents = pgTable("audit_events", { id: id(), locationId: uuid("location_id"), userId: foreignId("user_id"), type: text("type").notNull(), detail: text("detail").notNull(), createdAt: createdAt() });

export const foundationTables = {
  organisations, users, locations, memberships, teamMembers, scheduledTasks, equipment,
  temperatureRounds, temperatureReadings, probeProducts, checklistQuestions, checklistResponses,
  checklistSignOffs, securityQuestions, securityResponses, securitySignOffs, foodChecks,
  wastageItems, wastageRecords, catalogueProducts, catalogueSyncStatus, cleaningTasks,
  cleaningCompletions, trainingRequirements, trainingDocumentVersions, trainingCompletions,
  additionalRequirements, additionalCompletions, rechecks, issues, issueUpdates, auditEvents,
} as const;
