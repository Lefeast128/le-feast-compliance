import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

const id = () => uuid("id").defaultRandom().primaryKey();
const createdAt = (name = "created_at") => timestamp(name, { withTimezone: true }).defaultNow().notNull();
const timestampColumn = (name: string) => timestamp(name, { withTimezone: true });
export const userRole = pgEnum("user_role", ["user", "admin"]);
export const membershipRole = pgEnum("membership_role", ["staff", "manager"]);
export const temperatureSession = pgEnum("temperature_session", ["AM", "PM"]);
export const temperatureResult = pgEnum("temperature_result", ["normal", "within_limit", "fail"]);
export const checklistKind = pgEnum("checklist_kind", ["opening", "closing"]);
export const issueStatus = pgEnum("issue_status", ["open", "monitoring", "resolved"]);
export const centralAllocationMode = pgEnum("central_allocation_mode", ["all", "selected"]);

export type StructuredStepResponseType = "confirm" | "yes_no" | "number" | "short_text";
export type StructuredStepDefinition = {
  id: string;
  label: string;
  description?: string | null;
  responseType: StructuredStepResponseType;
  required?: boolean;
};

export const organisations = pgTable("organisations", {
  id: id(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/London"),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  organisationId: uuid("organisation_id").references(() => organisations.id, { onDelete: "restrict" }),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull(),
  name: text("name"),
  role: userRole("role").notNull().default("user"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  passwordSetAt: timestampColumn("password_set_at"),
  isAnonymous: boolean("is_anonymous").notNull().default(false),
  createdAt: createdAt(),
}, table => ({ normalizedEmail: uniqueIndex("users_normalized_email_idx").on(table.normalizedEmail) }));

export const locations = pgTable("locations", {
  id: id(), organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }), name: text("name").notNull(),
  shortName: text("short_name").notNull(), timezone: text("timezone").notNull().default("Europe/London"),
  active: boolean("active").notNull().default(true), createdAt: createdAt(),
}, table => ({ organisationActive: index("locations_organisation_active_idx").on(table.organisationId, table.active) }));

export const memberships = pgTable("memberships", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  role: membershipRole("role").notNull(), createdAt: createdAt(),
}, table => ({ userLocation: uniqueIndex("memberships_user_location_idx").on(table.userId, table.locationId) }));

export const teamMembers = pgTable("team_members", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), name: text("name").notNull(),
  role: text("role").notNull().default("team"), active: boolean("active").notNull().default(true), createdAt: createdAt(),
});

export const centralChecklistItems = pgTable("central_checklist_items", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
  checklist: checklistKind("checklist").notNull(),
  question: text("question").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default("simple"),
  steps: jsonb("steps").$type<StructuredStepDefinition[]>().notNull().default([]),
  locationIds: jsonb("location_ids").$type<string[]>().notNull(),
  allocationMode: centralAllocationMode("allocation_mode").notNull().default("selected"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: timestampColumn("updated_at"),
});

export const centralOperationalItems = pgTable("central_operational_items", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
  kind: text("kind").notNull(),
  checklist: checklistKind("checklist"),
  session: temperatureSession("session"),
  name: text("name"),
  question: text("question"),
  description: text("description"),
  taskType: text("task_type").notNull().default("simple"),
  steps: jsonb("steps").$type<StructuredStepDefinition[]>().notNull().default([]),
  frequency: text("frequency"),
  interval: integer("interval"),
  weekdays: jsonb("weekdays").$type<number[]>(),
  dayOfMonth: integer("day_of_month"),
  nextDueAt: timestampColumn("next_due_at"),
  fields: jsonb("fields"),
  locationIds: jsonb("location_ids").$type<string[]>().notNull(),
  allocationMode: centralAllocationMode("allocation_mode").notNull().default("selected"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: timestampColumn("updated_at"),
});

export const scheduledTasks = pgTable("scheduled_tasks", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), title: text("title").notNull(), kind: text("kind").notNull(),
  session: text("session"), dueLabel: text("due_label").notNull(), status: text("status").notNull(),
  completedAt: timestampColumn("completed_at"), completedBy: uuid("completed_by").references(() => users.id, { onDelete: "restrict" }), createdAt: createdAt(),
});

export const equipment = pgTable("equipment", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), name: text("name").notNull(), type: text("type").notNull(),
  minimumTemperature: real("minimum_temperature").notNull().default(0), preferredTemperature: real("preferred_temperature"), maximumTemperature: real("maximum_temperature"), order: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), createdAt: createdAt(),
});

export const temperatureRounds = pgTable("temperature_rounds", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), session: temperatureSession("session").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(), completedAt: timestampColumn("completed_at"),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }), createdAt: createdAt(),
}, table => ({ locationStarted: index("temperature_rounds_location_started_idx").on(table.locationId, table.startedAt) }));

export const temperatureReadings = pgTable("temperature_readings", {
  id: id(), roundId: uuid("round_id").notNull().references(() => temperatureRounds.id, { onDelete: "restrict" }), equipmentId: uuid("equipment_id").notNull().references(() => equipment.id, { onDelete: "restrict" }), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  temperature: real("temperature").notNull(), result: temperatureResult("result").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }), voided: boolean("voided").notNull().default(false), equipmentName: text("equipment_name"),
  minimumTemperature: real("minimum_temperature"), preferredTemperature: real("preferred_temperature"), maximumTemperature: real("maximum_temperature"),
}, table => ({ locationCreated: index("temperature_readings_location_created_idx").on(table.locationId, table.createdAt), roundEquipment: uniqueIndex("temperature_readings_round_equipment_voided_idx").on(table.roundId, table.equipmentId, table.voided) }));

export const probeProducts = pgTable("probe_products", {
  id: id(), organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }), name: text("name").notNull(), minimumTemperature: real("minimum_temperature").notNull(),
  holdMinutes: integer("hold_minutes").notNull(), locationIds: jsonb("location_ids").$type<string[]>().notNull(), order: integer("sort_order"),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
}, table => ({ root: foreignKey({ columns: [table.versionRootId], foreignColumns: [table.id], name: "probe_products_root_fk" }).onDelete("restrict") }));

export const checklistQuestions = pgTable("checklist_questions", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), checklist: checklistKind("checklist").notNull(), question: text("question").notNull(), description: text("description"), taskType: text("task_type").notNull().default("simple"), steps: jsonb("steps").$type<StructuredStepDefinition[]>().notNull().default([]), order: integer("sort_order").notNull(),
  centralItemId: uuid("central_item_id").references(() => centralChecklistItems.id, { onDelete: "restrict" }),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
}, table => ({ root: foreignKey({ columns: [table.versionRootId], foreignColumns: [table.id], name: "checklist_questions_root_fk" }).onDelete("restrict") }));
export const checklistResponses = pgTable("checklist_responses", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), checklist: checklistKind("checklist").notNull(), questionId: uuid("question_id").notNull().references(() => checklistQuestions.id, { onDelete: "restrict" }), answer: text("answer").notNull(),
  problem: text("problem"), action: text("action"), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({ locationCreated: index("checklist_responses_location_created_idx").on(table.locationId, table.createdAt) }));
export const checklistSignOffs = pgTable("checklist_sign_offs", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), checklist: checklistKind("checklist").notNull(), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({ day: uniqueIndex("checklist_sign_offs_day_idx").on(table.locationId, table.checklist, table.dateKey) }));

export const securityQuestions = pgTable("security_questions", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), session: temperatureSession("session").notNull(), question: text("question").notNull(), description: text("description"), taskType: text("task_type").notNull().default("simple"), steps: jsonb("steps").$type<StructuredStepDefinition[]>().notNull().default([]), order: integer("sort_order").notNull(),
  centralItemId: uuid("central_item_id").references(() => centralOperationalItems.id, { onDelete: "restrict" }),
  active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), createdAt: createdAt(),
}, table => ({ root: foreignKey({ columns: [table.versionRootId], foreignColumns: [table.id], name: "security_questions_root_fk" }).onDelete("restrict") }));
export const securityResponses = pgTable("security_responses", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), session: temperatureSession("session").notNull(), questionId: uuid("question_id").notNull().references(() => securityQuestions.id, { onDelete: "restrict" }), answer: text("answer").notNull(), issue: text("issue"),
  createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({ locationCreated: index("security_responses_location_created_idx").on(table.locationId, table.createdAt) }));
export const securitySignOffs = pgTable("security_sign_offs", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), session: temperatureSession("session").notNull(), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({ day: uniqueIndex("security_sign_offs_day_idx").on(table.locationId, table.session, table.dateKey) }));

export const foodChecks = pgTable("food_checks", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), product: text("product").notNull(), quantity: text("quantity"), temperature: real("temperature").notNull(), result: text("result").notNull(), action: text("action"),
  createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }), probeProductId: uuid("probe_product_id").references(() => probeProducts.id, { onDelete: "restrict" }), minimumTemperature: real("minimum_temperature"), holdMinutes: integer("hold_minutes"),
}, table => ({ locationCreated: index("food_checks_location_created_idx").on(table.locationId, table.createdAt) }));
export const wastageItems = pgTable("wastage_items", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), name: text("name").notNull(), active: boolean("active").notNull().default(true), order: integer("sort_order").notNull().default(0), createdAt: createdAt() });
export const wastageRecords = pgTable("wastage_records", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), itemId: uuid("item_id").references(() => wastageItems.id, { onDelete: "restrict" }), catalogueProductId: uuid("catalogue_product_id").references(() => catalogueProducts.id, { onDelete: "restrict" }), itemName: text("item_name"), cataloguePlu: integer("catalogue_plu"), categorySnapshot: text("category_snapshot"), wastageSource: text("wastage_source").notNull().default("legacy"), quantity: text("quantity"), notes: text("notes"), noWaste: boolean("no_waste").notNull().default(false), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({ locationCreated: index("wastage_records_location_created_idx").on(table.locationId, table.createdAt), catalogueProduct: index("wastage_records_catalogue_product_idx").on(table.catalogueProductId) }));
export const catalogueProducts = pgTable("catalogue_products", {
  id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), siteId: text("site_id").notNull(), plu: integer("plu").notNull(), name: text("name").notNull(), department: text("department"), group: text("product_group"), valueSources: jsonb("value_sources"), active: boolean("active").notNull().default(true), needsCategoryReview: boolean("needs_category_review").notNull().default(true), wastageCategory: text("wastage_category"), excludedFromWastage: boolean("excluded_from_wastage").notNull().default(false), wastageReviewedAt: timestampColumn("wastage_reviewed_at"), wastageReviewedBy: uuid("wastage_reviewed_by").references(() => users.id, { onDelete: "restrict" }), firstSeenAt: createdAt("first_seen_at"), lastSeenAt: createdAt("last_seen_at"), lastSuccessfulSyncAt: createdAt("last_successful_sync_at"),
}, table => ({ locationPlu: uniqueIndex("catalogue_products_location_plu_idx").on(table.locationId, table.plu), wastagePicker: index("catalogue_products_wastage_picker_idx").on(table.locationId, table.active, table.excludedFromWastage, table.plu) }));
export const catalogueSyncStatus = pgTable("catalogue_sync_status", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), lastSuccessfulSyncAt: timestampColumn("last_successful_sync_at"), lastAttemptedSyncAt: createdAt("last_attempted_sync_at"), lastError: text("last_error"), productCount: integer("product_count"), addedCount: integer("added_count"), renamedCount: integer("renamed_count"), removedCount: integer("removed_count") }, table => ({ location: uniqueIndex("catalogue_sync_status_location_idx").on(table.locationId) }));

export const cleaningTasks = pgTable("cleaning_tasks", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), name: text("name").notNull(), description: text("description"), taskType: text("task_type").notNull().default("simple"), steps: jsonb("steps").$type<StructuredStepDefinition[]>().notNull().default([]), frequency: text("frequency").notNull(), weekdays: jsonb("weekdays").$type<number[]>().notNull(), centralItemId: uuid("central_item_id").references(() => centralOperationalItems.id, { onDelete: "restrict" }), active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), order: integer("sort_order").notNull().default(0), createdAt: createdAt() }, table => ({ root: foreignKey({ columns: [table.versionRootId], foreignColumns: [table.id], name: "cleaning_tasks_root_fk" }).onDelete("restrict") }));
export const cleaningCompletions = pgTable("cleaning_completions", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), taskId: uuid("task_id").notNull().references(() => cleaningTasks.id, { onDelete: "restrict" }), dateKey: text("date_key").notNull(), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }) }, table => ({ locationDate: index("cleaning_completions_location_date_idx").on(table.locationId, table.dateKey), taskDay: uniqueIndex("cleaning_completions_task_day_idx").on(table.locationId, table.taskId, table.dateKey) }));

export const structuredTaskResponses = pgTable("structured_task_responses", {
  id: id(),
  locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  taskArea: text("task_area").notNull(),
  taskId: uuid("task_id").notNull(),
  stepId: text("step_id").notNull(),
  responseType: text("response_type").notNull(),
  responseValue: text("response_value").notNull(),
  dateKey: text("date_key").notNull(),
  createdAt: createdAt(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }),
}, table => ({
  taskDayStep: uniqueIndex("structured_task_responses_task_day_step_idx").on(table.locationId, table.taskArea, table.taskId, table.dateKey, table.stepId),
  locationDate: index("structured_task_responses_location_date_idx").on(table.locationId, table.dateKey),
}));

export const documents = pgTable("documents", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
  locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  storageProvider: text("storage_provider").notNull().default("vercel_blob"),
  pathname: text("pathname").notNull(),
  originalFilename: text("original_filename").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  purpose: text("purpose").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  deletedAt: timestampColumn("deleted_at"),
}, table => ({
  pathname: uniqueIndex("documents_pathname_idx").on(table.pathname),
  locationPurpose: index("documents_location_purpose_idx").on(table.locationId, table.purpose, table.status),
}));

export const centralTrainingPublications = pgTable("central_training_publications", {
  id: id(),
  organisationId: uuid("organisation_id").notNull().references(() => organisations.id, { onDelete: "restrict" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  audience: text("audience"),
  trainingFormat: text("training_format").notNull().default("briefing"),
  locationIds: jsonb("location_ids").$type<string[]>().notNull(),
  allocationMode: centralAllocationMode("allocation_mode").notNull().default("selected"),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
  updatedAt: timestampColumn("updated_at"),
});

export const trainingRequirements = pgTable("training_requirements", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), title: text("title").notNull(), active: boolean("active").notNull().default(true), order: integer("sort_order").notNull().default(0), documentStorageId: text("document_storage_id"), documentName: text("document_name"), currentDocumentVersionId: uuid("current_document_version_id"), requiredDocumentVersionId: uuid("required_document_version_id"), trainingFormat: text("training_format").notNull().default("briefing"), currentContentVersionId: uuid("current_content_version_id"), requiredContentVersionId: uuid("required_content_version_id"), description: text("description"), category: text("category"), audience: text("audience"), selectedTeamMemberIds: jsonb("selected_team_member_ids").$type<string[]>(), centralPublicationId: uuid("central_publication_id").references(() => centralTrainingPublications.id, { onDelete: "restrict" }), createdAt: createdAt() });
export const trainingDocumentVersions = pgTable("training_document_versions", { id: id(), requirementId: uuid("requirement_id").notNull().references(() => trainingRequirements.id, { onDelete: "restrict" }), documentId: uuid("document_id").references(() => documents.id, { onDelete: "restrict" }), versionNumber: integer("version_number").notNull(), storageId: text("storage_id").notNull(), documentName: text("document_name").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), requiresReacknowledgement: boolean("requires_reacknowledgement") });
export const trainingContentVersions = pgTable("training_content_versions", { id: id(), requirementId: uuid("requirement_id").notNull(), versionNumber: integer("version_number").notNull(), content: text("content").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), requiresReacknowledgement: boolean("requires_reacknowledgement") });
export const trainingCompletions = pgTable("training_completions", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), requirementId: uuid("requirement_id").notNull().references(() => trainingRequirements.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "restrict" }), documentVersionId: uuid("document_version_id").references(() => trainingDocumentVersions.id, { onDelete: "restrict" }), contentVersionId: uuid("content_version_id").references(() => trainingContentVersions.id, { onDelete: "restrict" }), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }) }, table => ({ locationMember: index("training_completions_location_member_idx").on(table.locationId, table.teamMemberId), requirement: index("training_completions_requirement_idx").on(table.requirementId) }));

export const trainingRequirementsRelations = relations(trainingRequirements, ({ one }) => ({
  currentDocumentVersion: one(trainingDocumentVersions, {
    fields: [trainingRequirements.currentDocumentVersionId],
    references: [trainingDocumentVersions.id],
    relationName: "currentDocumentVersion",
  }),
  requiredDocumentVersion: one(trainingDocumentVersions, {
    fields: [trainingRequirements.requiredDocumentVersionId],
    references: [trainingDocumentVersions.id],
    relationName: "requiredDocumentVersion",
  }),
}));

export const additionalRequirements = pgTable("additional_requirements", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), title: text("title").notNull(), description: text("description"), frequency: text("frequency").notNull(), interval: integer("interval"), weekdays: jsonb("weekdays").$type<number[]>().notNull().default([]), dayOfMonth: integer("day_of_month"), nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(), fields: jsonb("fields").notNull(), centralItemId: uuid("central_item_id").references(() => centralOperationalItems.id, { onDelete: "restrict" }), active: boolean("active").notNull().default(true), deactivatedAt: timestamp("deactivated_at", { withTimezone: true }), versionRootId: uuid("version_root_id"), order: integer("sort_order").notNull().default(0), createdAt: createdAt() }, table => ({ root: foreignKey({ columns: [table.versionRootId], foreignColumns: [table.id], name: "additional_requirements_root_fk" }).onDelete("restrict"), locationDue: index("additional_requirements_location_due_idx").on(table.locationId, table.active, table.nextDueAt) }));
export const additionalCompletions = pgTable("additional_completions", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), requirementId: uuid("requirement_id").notNull().references(() => additionalRequirements.id, { onDelete: "restrict" }), completedAt: timestamp("completed_at", { withTimezone: true }).notNull(), checkedDate: text("checked_date"), nextDueAt: timestamp("next_due_at", { withTimezone: true }), scheduledDueAt: timestamp("scheduled_due_at", { withTimezone: true }), answers: jsonb("answers").notNull(), certificateReference: text("certificate_reference"), documentId: uuid("document_id").references(() => documents.id, { onDelete: "restrict" }), documentStorageId: text("document_storage_id"), documentName: text("document_name"), teamMemberId: uuid("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "restrict" }), completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }) }, table => ({ locationCompleted: index("additional_completions_location_completed_idx").on(table.locationId, table.completedAt), requirementCompleted: index("additional_completions_requirement_completed_idx").on(table.requirementId, table.completedAt), document: index("additional_completions_document_idx").on(table.documentId) }));

export const issues = pgTable("issues", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), category: text("category").notNull(), title: text("title").notNull(), description: text("description").notNull(), status: issueStatus("status").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }), action: text("action"), resolvedAt: timestampColumn("resolved_at"), resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "restrict" }), resolutionNote: text("resolution_note"), originalReading: text("original_reading"), sourceTemperatureReadingId: uuid("source_temperature_reading_id").references(() => temperatureReadings.id, { onDelete: "restrict" }), sourceFoodCheckId: uuid("source_food_check_id").references(() => foodChecks.id, { onDelete: "restrict" }), sourceAdditionalCompletionId: uuid("source_additional_completion_id").references(() => additionalCompletions.id, { onDelete: "restrict" }) }, table => ({ locationStatusCreated: index("issues_location_status_created_idx").on(table.locationId, table.status, table.createdAt) }));
export const rechecks = pgTable("rechecks", { id: id(), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "restrict" }), readingId: uuid("reading_id").references(() => temperatureReadings.id, { onDelete: "restrict" }), temperature: real("temperature").notNull(), result: text("result").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }) });
export const issueUpdates = pgTable("issue_updates", { id: id(), issueId: uuid("issue_id").notNull().references(() => issues.id, { onDelete: "restrict" }), locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }), updateType: text("update_type").notNull(), note: text("note").notNull(), status: issueStatus("status").notNull(), createdAt: createdAt(), createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }), teamMemberId: uuid("team_member_id").references(() => teamMembers.id, { onDelete: "restrict" }) }, table => ({ issueCreated: index("issue_updates_issue_created_idx").on(table.issueId, table.createdAt), locationCreated: index("issue_updates_location_created_idx").on(table.locationId, table.createdAt) }));
export const auditEvents = pgTable("audit_events", { id: id(), locationId: uuid("location_id").references(() => locations.id, { onDelete: "restrict" }), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }), type: text("type").notNull(), detail: text("detail").notNull(), createdAt: createdAt() });
export const managerReviews = pgTable("manager_reviews", {
  id: id(),
  locationId: uuid("location_id").notNull().references(() => locations.id, { onDelete: "restrict" }),
  reviewType: text("review_type").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
  completedBy: uuid("completed_by").notNull().references(() => users.id, { onDelete: "restrict" }),
  summary: jsonb("summary").notNull(),
  seriousProblems: boolean("serious_problems"),
  details: text("details"),
  actionTaken: text("action_taken"),
  answers: jsonb("answers"),
  createdAt: createdAt(),
}, table => ({ period: uniqueIndex("manager_reviews_period_idx").on(table.locationId, table.reviewType, table.periodStart) }));

export const authOtpChallenges = pgTable("auth_otp_challenges", {
  id: id(), normalizedEmail: text("normalized_email").notNull(), otpDigest: text("otp_digest").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), consumedAt: timestampColumn("consumed_at"), invalidatedAt: timestampColumn("invalidated_at"),
  failedAttempts: integer("failed_attempts").notNull().default(0), maxAttempts: integer("max_attempts").notNull().default(5),
  rateLimitKey: text("rate_limit_key").notNull(), createdAt: createdAt(),
}, table => ({ emailCreated: index("auth_otp_challenges_email_created_idx").on(table.normalizedEmail, table.createdAt), rateCreated: index("auth_otp_challenges_rate_created_idx").on(table.rateLimitKey, table.createdAt) }));

export const authSessions = pgTable("auth_sessions", {
  id: id(), userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "restrict" }), tokenHash: text("token_hash").notNull(),
  createdAt: createdAt(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), revokedAt: timestampColumn("revoked_at"), lastUsedAt: timestampColumn("last_used_at"), rotatedFromId: uuid("rotated_from_id"),
}, table => ({ token: uniqueIndex("auth_sessions_token_hash_idx").on(table.tokenHash), user: index("auth_sessions_user_created_idx").on(table.userId, table.createdAt) }));

export const foundationTables = {
  organisations, users, locations, memberships, teamMembers, scheduledTasks, equipment,
  temperatureRounds, temperatureReadings, probeProducts, checklistQuestions, checklistResponses,
  checklistSignOffs, securityQuestions, securityResponses, securitySignOffs, foodChecks,
  wastageItems, wastageRecords, catalogueProducts, catalogueSyncStatus, cleaningTasks,
  cleaningCompletions, documents, trainingRequirements, trainingDocumentVersions, trainingCompletions,
  centralTrainingPublications, centralChecklistItems, centralOperationalItems,
  additionalRequirements, additionalCompletions, structuredTaskResponses, trainingContentVersions, rechecks, issues, issueUpdates, auditEvents, managerReviews,
  authOtpChallenges, authSessions,
} as const;
