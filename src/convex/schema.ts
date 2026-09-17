import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.MANAGER),
  v.literal(ROLES.STAFF),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(roleValidator),
  }).index("email", ["email"]),
  organisations: defineTable({ name: v.string(), timezone: v.string() }),
  locations: defineTable({
    organisationId: v.id("organisations"),
    name: v.string(),
    shortName: v.string(),
    timezone: v.string(),
    active: v.boolean(),
  }).index("by_organisation", ["organisationId"]),
  memberships: defineTable({
    userId: v.id("users"),
    locationId: v.id("locations"),
    role: roleValidator,
  }).index("by_user", ["userId"]),
  equipment: defineTable({
    locationId: v.id("locations"),
    name: v.string(),
    type: v.string(),
    preferredTemperature: v.optional(v.number()),
    maximumTemperature: v.optional(v.number()),
    order: v.number(),
    active: v.boolean(),
  }).index("by_location", ["locationId"]),
  scheduledTasks: defineTable({
    locationId: v.id("locations"),
    title: v.string(),
    kind: v.union(v.literal("temperature"), v.literal("probe")),
    session: v.optional(v.union(v.literal("AM"), v.literal("PM"))),
    dueLabel: v.string(),
    status: v.union(v.literal("complete"), v.literal("due"), v.literal("upcoming"), v.literal("overdue")),
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.id("users")),
  }).index("by_location", ["locationId"]),
  temperatureRounds: defineTable({
    locationId: v.id("locations"),
    session: v.union(v.literal("AM"), v.literal("PM")),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdBy: v.id("users"),
  }).index("by_location", ["locationId"]),
  temperatureReadings: defineTable({
    roundId: v.id("temperatureRounds"),
    equipmentId: v.id("equipment"),
    locationId: v.id("locations"),
    temperature: v.number(),
    result: v.union(v.literal("normal"), v.literal("within_limit"), v.literal("fail")),
    createdAt: v.number(),
    createdBy: v.id("users"),
    voided: v.boolean(),
  }).index("by_round", ["roundId"]).index("by_location", ["locationId"]),
  probeProducts: defineTable({
    organisationId: v.id("organisations"),
    name: v.string(),
    minimumTemperature: v.number(),
    holdMinutes: v.number(),
    locationIds: v.array(v.id("locations")),
    active: v.boolean(),
  }).index("by_organisation", ["organisationId"]),
  checklistQuestions: defineTable({
    locationId: v.id("locations"),
    checklist: v.union(v.literal("opening"), v.literal("closing")),
    question: v.string(),
    order: v.number(),
    active: v.boolean(),
  }).index("by_location_checklist", ["locationId", "checklist"]),
  checklistResponses: defineTable({
    locationId: v.id("locations"),
    checklist: v.union(v.literal("opening"), v.literal("closing")),
    questionId: v.id("checklistQuestions"),
    answer: v.union(v.literal("yes"), v.literal("no"), v.literal("na")),
    problem: v.optional(v.string()),
    action: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.id("users"),
  }).index("by_location_checklist", ["locationId", "checklist"]),
  foodChecks: defineTable({
    locationId: v.id("locations"),
    product: v.string(),
    quantity: v.optional(v.string()),
    temperature: v.number(),
    result: v.union(v.literal("pass"), v.literal("fail")),
    action: v.optional(v.string()),
    createdAt: v.number(),
    createdBy: v.id("users"),
  }).index("by_location", ["locationId"]),
  issues: defineTable({
    locationId: v.id("locations"),
    category: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.union(v.literal("open"), v.literal("monitoring"), v.literal("resolved")),
    createdAt: v.number(),
    createdBy: v.id("users"),
    action: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
  }).index("by_location", ["locationId"]),
  auditEvents: defineTable({
    locationId: v.optional(v.id("locations")),
    userId: v.id("users"),
    type: v.string(),
    detail: v.string(),
    createdAt: v.number(),
  }).index("by_location", ["locationId"]),
});

export default schema;
