import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireLocationAccess, requireLocationManager } from "./permissions";

const frequencyValidator = v.union(v.literal("weekly"), v.literal("monthly"), v.literal("every_x_weeks"), v.literal("every_x_months"), v.literal("annual"), v.literal("one_off"));
const fieldValidator = v.object({ key: v.string(), label: v.string(), type: v.union(v.literal("temperature"), v.literal("number"), v.literal("yes_no"), v.literal("completed"), v.literal("date"), v.literal("text"), v.literal("actions"), v.literal("pdf")), minimum: v.optional(v.number()), maximum: v.optional(v.number()), options: v.optional(v.array(v.string())) });
const answerValidator = v.object({ key: v.string(), value: v.string() });

function validateFields(fields: { key: string; label: string; type: string; minimum?: number; maximum?: number }[]) {
  if (!fields.length) {
    throw new Error("At least one field is required");
  }

  const keys = new Set<string>();

  for (const field of fields) {
    const key = field.key.trim();
    if (!key) throw new Error("Field key is required");
    if (!field.label.trim()) throw new Error("Field label is required");
    if (keys.has(key)) throw new Error(`Duplicate field key: ${key}`);
    keys.add(key);
    if (field.type !== "number" && field.type !== "temperature") continue;
    if (field.minimum !== undefined && !Number.isFinite(field.minimum)) throw new Error(`${field.label} minimum must be a valid number`);
    if (field.maximum !== undefined && !Number.isFinite(field.maximum)) throw new Error(`${field.label} maximum must be a valid number`);
    if (field.minimum !== undefined && field.maximum !== undefined && field.minimum > field.maximum) throw new Error(`${field.label} minimum cannot be greater than maximum`);
  }
}

function validateInterval(frequency: string, interval?: number) {
  if (frequency !== "every_x_weeks" && frequency !== "every_x_months") return;
  if (interval === undefined || !Number.isFinite(interval) || !Number.isInteger(interval) || interval < 1) {
    throw new Error("Interval must be a whole number of at least 1");
  }
}

function localDateKey(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));

  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${value("year")}-${value("month")}-${value("day")}`;
}

async function signedIn(ctx: any) { const userId = await getAuthUserId(ctx); if (!userId) throw new Error("You must be signed in"); return userId; }
function addMonthsClamped(from: number, months: number) {
  const source = new Date(from);
  const target = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return target.getTime();
}

function addYearsClamped(from: number, years: number) {
  const source = new Date(from);
  const target = new Date(Date.UTC(
    source.getUTCFullYear() + years,
    source.getUTCMonth(),
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), lastDay));
  return target.getTime();
}

function nextDue(frequency: string, interval = 1, from: number) {
  const date = new Date(from);
  if (frequency === "one_off") return from;
  if (frequency === "weekly") {
    date.setUTCDate(date.getUTCDate() + 7);
    return date.getTime();
  }
  if (frequency === "monthly") return addMonthsClamped(from, 1);
  if (frequency === "every_x_weeks") {
    date.setUTCDate(date.getUTCDate() + 7 * Math.max(1, interval));
    return date.getTime();
  }
  if (frequency === "every_x_months") return addMonthsClamped(from, Math.max(1, interval));
  if (frequency === "annual") return addYearsClamped(from, 1);
  return date.getTime();
}

export const dashboard = query({ args: { locationId: v.id("locations") }, handler: async (ctx, args) => { await requireLocationAccess(ctx, args.locationId); const location = await ctx.db.get(args.locationId); if (!location) throw new Error("Location not found"); const now = Date.now(); const todayKey = localDateKey(now, location.timezone); const all = (await ctx.db.query("additionalRequirements").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect()).filter(item => item.active).sort((a, b) => a.order - b.order); const allCompletions = await Promise.all((await ctx.db.query("additionalCompletions").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect()).map(async item => { const completionRequirement = await ctx.db.get(item.requirementId); return { ...item, requirementRootId: completionRequirement?.versionRootId ?? completionRequirement?._id, teamMemberName: (await ctx.db.get(item.teamMemberId))?.name, documentUrl: item.documentStorageId ? await ctx.storage.getUrl(item.documentStorageId) : null }; })); const requirements = all.filter(item => { const root = item.versionRootId ?? item._id; return localDateKey(item.nextDueAt, location.timezone) <= todayKey || allCompletions.some(completion => completion.requirementRootId === root && localDateKey(completion.completedAt, location.timezone) === todayKey); }); return { requirements, completions: allCompletions }; } });
export const history = query({ args: { locationId: v.id("locations"), start: v.number(), end: v.number() }, handler: async (ctx, args) => { await requireLocationAccess(ctx, args.locationId); return await Promise.all((await ctx.db.query("additionalCompletions").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect()).filter(item => item.completedAt >= args.start && item.completedAt <= args.end).map(async item => ({ ...item, teamMemberName: (await ctx.db.get(item.teamMemberId))?.name, requirementTitle: (await ctx.db.get(item.requirementId))?.title, documentUrl: item.documentStorageId ? await ctx.storage.getUrl(item.documentStorageId) : null }))); } });
export const list = query({ args: { locationId: v.id("locations") }, handler: async (ctx, args) => { await requireLocationManager(ctx, args.locationId); return (await ctx.db.query("additionalRequirements").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect()).filter(item => item.active).sort((a, b) => a.order - b.order); } });
export const generateUploadUrl = mutation({ args: {}, handler: async (ctx) => { await signedIn(ctx); return await ctx.storage.generateUploadUrl(); } });
export const add = mutation({ args: { locationId: v.id("locations"), title: v.string(), description: v.optional(v.string()), frequency: frequencyValidator, interval: v.optional(v.number()), nextDueAt: v.number(), fields: v.array(fieldValidator) }, handler: async (ctx, args) => { await requireLocationManager(ctx, args.locationId); validateFields(args.fields); validateInterval(args.frequency, args.interval); const all = await ctx.db.query("additionalRequirements").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect(); return await ctx.db.insert("additionalRequirements", { ...args, title: args.title.trim(), active: true, order: all.length }); } });
export const update = mutation({ args: { requirementId: v.id("additionalRequirements"), title: v.string(), description: v.optional(v.string()), frequency: frequencyValidator, interval: v.optional(v.number()), nextDueAt: v.number(), fields: v.array(fieldValidator) }, handler: async (ctx, args) => { const requirement = await ctx.db.get(args.requirementId); if (!requirement) throw new Error("Requirement not found"); if (requirement.active !== true) throw new Error("This configuration version is no longer active"); await requireLocationManager(ctx, requirement.locationId); validateFields(args.fields); validateInterval(args.frequency, args.interval); const root = requirement.versionRootId ?? requirement._id; const now = Date.now(); await ctx.db.patch(args.requirementId, { active: false, deactivatedAt: now }); await ctx.db.insert("additionalRequirements", { locationId: requirement.locationId, title: args.title.trim(), description: args.description, frequency: args.frequency, interval: args.interval, nextDueAt: args.nextDueAt, fields: args.fields, active: true, order: requirement.order, versionRootId: root }); } });
export const remove = mutation({ args: { requirementId: v.id("additionalRequirements") }, handler: async (ctx, args) => { const requirement = await ctx.db.get(args.requirementId); if (!requirement) throw new Error("Requirement not found"); await requireLocationManager(ctx, requirement.locationId); if (requirement.active !== true) throw new Error("This configuration version is no longer active"); await ctx.db.patch(args.requirementId, { active: false, deactivatedAt: Date.now() }); } });
export const reorder = mutation({ args: { requirementId: v.id("additionalRequirements"), direction: v.union(v.literal("up"), v.literal("down")) }, handler: async (ctx, args) => { const current = await ctx.db.get(args.requirementId); if (!current) throw new Error("Requirement not found"); await requireLocationManager(ctx, current.locationId); const items = (await ctx.db.query("additionalRequirements").withIndex("by_location", q => q.eq("locationId", current.locationId)).collect()).filter(item => item.active).sort((a, b) => a.order - b.order); const index = items.findIndex(item => item._id === args.requirementId); const target = args.direction === "up" ? index - 1 : index + 1; if (index < 0 || !items[target]) return; await ctx.db.patch(items[index]._id, { order: items[target].order }); await ctx.db.patch(items[target]._id, { order: items[index].order }); } });
export const complete = mutation({ args: { locationId: v.id("locations"), requirementId: v.id("additionalRequirements"), teamMemberId: v.id("teamMembers"), answers: v.array(answerValidator), checkedDate: v.optional(v.string()), certificateReference: v.optional(v.string()), documentStorageId: v.optional(v.id("_storage")), documentName: v.optional(v.string()) }, handler: async (ctx, args) => { const userId = await signedIn(ctx); await requireLocationAccess(ctx, args.locationId); const location = await ctx.db.get(args.locationId); if (!location) throw new Error("Location not found"); const requirement = await ctx.db.get(args.requirementId); if (!requirement || requirement.locationId !== args.locationId) throw new Error("Requirement does not belong to this location"); if (requirement.active !== true) throw new Error("This configuration version is no longer active"); const teamMember = await ctx.db.get(args.teamMemberId); if (!teamMember || teamMember.locationId !== args.locationId) throw new Error("Team member does not belong to this location"); if (teamMember.active !== true) throw new Error("Team member is inactive"); const answerMap = new Map<string, string>(); const configuredKeys = new Set(requirement.fields.map(field => field.key)); for (const answer of args.answers) { if (!configuredKeys.has(answer.key)) throw new Error("Answer does not belong to this requirement"); if (answerMap.has(answer.key)) throw new Error("Duplicate answer"); answerMap.set(answer.key, answer.value.trim()); } for (const field of requirement.fields) { if (field.type === "pdf" || field.type === "actions") continue; if (!answerMap.get(field.key)) throw new Error(`${field.label} is required`); } if (requirement.fields.some(field => field.type === "pdf") && !args.documentStorageId) throw new Error("PDF document is required"); for (const field of requirement.fields) { if (field.type === "pdf" || field.type === "actions") continue; const value = answerMap.get(field.key)!; if (field.type === "yes_no" && value !== "yes" && value !== "no") throw new Error(`${field.label} must be Yes or No`); if (field.type === "completed" && value !== "completed") throw new Error(`${field.label} must be completed`); if ((field.type === "number" || field.type === "temperature") && !Number.isFinite(Number(value))) throw new Error(`${field.label} must be a valid number`); if (field.type === "date") { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field.label} must be a valid date`); const [year, month, day] = value.split("-").map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new Error(`${field.label} must be a valid date`); } } for (const field of requirement.fields) { if (field.type !== "actions") continue; const value = answerMap.get(field.key); if (!value) continue; if (field.options?.length && !field.options.includes(value)) throw new Error(`${field.label} must use a configured action`); } const failedFields: any[] = []; for (const field of requirement.fields) { const value = answerMap.get(field.key)!; if (field.type === "yes_no" && value === "no") failedFields.push({ key: field.key, label: field.label, value, minimum: field.minimum, maximum: field.maximum }); if (field.type === "number" || field.type === "temperature") { const numeric = Number(value); const belowMinimum = field.minimum !== undefined && numeric < field.minimum; const aboveMaximum = field.maximum !== undefined && numeric > field.maximum; if (belowMinimum || aboveMaximum) failedFields.push({ key: field.key, label: field.label, value, minimum: field.minimum, maximum: field.maximum }); } } const actionFields = requirement.fields.filter(field => field.type === "actions"); const correctiveAction = actionFields.map(field => answerMap.get(field.key)?.trim()).find(Boolean); if (failedFields.length && !correctiveAction) throw new Error("Corrective action is required for a failed additional check"); const now = Date.now(); const scheduledDueAt = requirement.nextDueAt; if (localDateKey(scheduledDueAt, location.timezone) > localDateKey(now, location.timezone)) throw new Error("This additional check is not due yet"); const due = nextDue(requirement.frequency, requirement.interval, scheduledDueAt); const id = await ctx.db.insert("additionalCompletions", { ...args, answers: args.answers.map(answer => ({ key: answer.key, value: answer.value.trim() })), scheduledDueAt, completedAt: now, nextDueAt: due, completedBy: userId }); if (failedFields.length > 0) { const failureSummary = failedFields.map(field => { const limits: string[] = []; if (field.minimum !== undefined) limits.push(`minimum ${field.minimum}`); if (field.maximum !== undefined) limits.push(`maximum ${field.maximum}`); return limits.length ? `${field.label}: ${field.value} (${limits.join(", ")})` : `${field.label}: ${field.value}`; }).join("; "); const issueId = await ctx.db.insert("issues", { locationId: args.locationId, category: "Additional check", title: `${requirement.title} requires action`, description: failureSummary, originalReading: failureSummary, sourceAdditionalCompletionId: id, status: "monitoring", action: correctiveAction, createdAt: now, createdBy: userId, teamMemberId: args.teamMemberId }); await ctx.db.insert("issueUpdates", { issueId, locationId: args.locationId, updateType: "immediate_action", note: correctiveAction!, status: "monitoring", createdAt: now, createdBy: userId, teamMemberId: args.teamMemberId }); } if (requirement.frequency === "one_off") await ctx.db.patch(requirement._id, { active: false, deactivatedAt: Date.now() }); else await ctx.db.patch(requirement._id, { nextDueAt: due }); return id; } });