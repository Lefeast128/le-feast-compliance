/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, checklistQuestions, cleaningTasks, equipment, issues, locations, memberships, probeProducts, scheduledTasks, securityQuestions, teamMembers, users, wastageItems } from "../db/schema.js";
import { requireLocationManager, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireFiniteNumber, requireString, requireUuid } from "../compliance/validation.js";

const db = () => getDb();
const id = (v: unknown, label: string) => requireUuid(v, label);
const text = (v: unknown, label: string) => requireString(v, label);

async function locationFor(context: AuthContext, locationId: string) {
  id(locationId, "locationId");
  const [location] = await db().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  requireLocationManager(context, location.id, location.organisationId);
  return location;
}

async function member(memberId: string) {
  id(memberId, "memberId");
  const [row] = await db().select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
  if (!row) throw new ApiError(404, "Team member not found");
  return row;
}

export async function listTeamMembers(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId);
  return db().select().from(teamMembers).where(eq(teamMembers.locationId, location.id)).orderBy(asc(teamMembers.name));
}
export async function addTeamMember(context: AuthContext, input: any) {
  const location = await locationFor(context, input.locationId);
  const name = text(input.name, "Name");
  const role = input.role ?? "team";
  requireEnum(role, "role", ["team", "manager"] as const);
  const [created] = await db().insert(teamMembers).values({ locationId: location.id, name, role, active: true }).returning();
  return created;
}
export async function updateTeamMember(context: AuthContext, memberId: string, input: any) {
  const current = await member(memberId);
  await locationFor(context, current.locationId);
  const patch: any = {};
  if (input.name !== undefined) patch.name = text(input.name, "Name");
  if (input.role !== undefined) { requireEnum(input.role, "role", ["team", "manager"] as const); patch.role = input.role; }
  if (input.active !== undefined) { if (typeof input.active !== "boolean") throw new ApiError(400, "active must be boolean"); patch.active = input.active; }
  if (!Object.keys(patch).length) throw new ApiError(400, "No changes supplied");
  const [updated] = await db().update(teamMembers).set(patch).where(eq(teamMembers.id, current.id)).returning();
  return updated;
}
export async function deleteTeamMember(context: AuthContext, memberId: string) {
  const current = await member(memberId);
  await locationFor(context, current.locationId);
  const [updated] = await db().update(teamMembers).set({ active: false }).where(eq(teamMembers.id, current.id)).returning();
  return updated;
}
export async function addMembership(context: AuthContext, input: any) {
  id(input.locationId, "locationId"); id(input.userId, "userId"); const [location] = await db().select().from(locations).where(eq(locations.id, input.locationId)).limit(1); if (!location) throw new ApiError(404, "Location not found"); requireOrganisationAdmin(context, location.organisationId); const role = requireEnum(input.role, "role", ["staff", "manager"] as const); const [user] = await db().select().from(users).where(and(eq(users.id, input.userId), eq(users.organisationId, location.organisationId))).limit(1); if (!user) throw new ApiError(404, "User not found"); const [row] = await db().insert(memberships).values({ userId: user.id, locationId: location.id, role }).onConflictDoUpdate({ target: [memberships.userId, memberships.locationId], set: { role } }).returning(); return row;
}
export async function removeMembership(context: AuthContext, membershipId: string) { id(membershipId, "membershipId"); const [row] = await db().select().from(memberships).where(eq(memberships.id, membershipId)).limit(1); if (!row) throw new ApiError(404, "Membership not found"); const [location] = await db().select().from(locations).where(eq(locations.id, row.locationId)).limit(1); if (!location) throw new ApiError(404, "Location not found"); requireOrganisationAdmin(context, location.organisationId); await db().delete(memberships).where(eq(memberships.id, row.id)); return { id: row.id, removed: true }; }

async function audit(tx: any, locationId: string | null, userId: string, type: string, detail: string) {
  await tx.insert(auditEvents).values({ locationId, userId, type, detail, createdAt: new Date() });
}
const finite = (v: unknown, label: string) => { requireFiniteNumber(v, label); return v as number; };
const orderFor = async (table: any, locationId: string) => {
  const rows = await db().select().from(table).where(eq(table.locationId, locationId));
  return rows.length;
};

export async function addEquipment(context: AuthContext, input: any) {
  const location = await locationFor(context, input.locationId);
  const name = input.name === undefined ? `Fridge ${(await orderFor(equipment, location.id)) + 1}` : text(input.name, "Name");
  const type = input.type === undefined ? "Food fridge" : text(input.type, "Type");
  const preferredTemperature = input.preferredTemperature === undefined ? 5 : finite(input.preferredTemperature, "preferredTemperature");
  const maximumTemperature = input.maximumTemperature === undefined ? 8 : finite(input.maximumTemperature, "maximumTemperature");
  if (preferredTemperature > maximumTemperature) throw new ApiError(422, "Preferred temperature cannot exceed maximum temperature");
  return db().transaction(async tx => { const [row] = await tx.insert(equipment).values({ locationId: location.id, name, type, preferredTemperature, maximumTemperature, order: await orderFor(equipment, location.id), active: true }).returning(); await audit(tx, location.id, context.user.id, "equipment_added", name); return row; });
}
export async function updateEquipment(context: AuthContext, equipmentId: string, input: any) {
  id(equipmentId, "equipmentId"); const [item] = await db().select().from(equipment).where(eq(equipment.id, equipmentId)).limit(1); if (!item) throw new ApiError(404, "Equipment not found");
  const location = await locationFor(context, item.locationId); if (!item.active) throw new ApiError(409, "This configuration version is no longer active");
  const preferredTemperature = finite(input.preferredTemperature, "preferredTemperature"); const maximumTemperature = finite(input.maximumTemperature, "maximumTemperature"); if (preferredTemperature > maximumTemperature) throw new ApiError(422, "Preferred temperature cannot exceed maximum temperature");
  return db().transaction(async tx => { const at = new Date(); await tx.update(equipment).set({ active: false, deactivatedAt: at }).where(eq(equipment.id, item.id)); const [replacement] = await tx.insert(equipment).values({ locationId: location.id, name: item.name, type: item.type, order: item.order, preferredTemperature, maximumTemperature, active: true }).returning(); await audit(tx, location.id, context.user.id, "equipment_limits_updated", `${item.name}: preferred ${preferredTemperature}°C, maximum ${maximumTemperature}°C`); return replacement; });
}
export async function setFridgeCount(context: AuthContext, input: any) {
  const location = await locationFor(context, input.locationId); const count = finite(input.count, "count"); if (!Number.isInteger(count) || count < 0) throw new ApiError(422, "count must be a whole number of at least 0");
  return db().transaction(async tx => { const rows = await tx.select().from(equipment).where(eq(equipment.locationId, location.id)); const active = rows.filter((r: any) => r.active).sort((a: any, b: any) => a.order - b.order); const at = new Date(); for (let i = 0; i < active.length; i++) await tx.update(equipment).set(i < count ? { name: `Fridge ${i + 1}`, active: true } : { name: `Fridge ${i + 1}`, active: false, deactivatedAt: at }).where(eq(equipment.id, active[i].id)); for (let i = active.length; i < count; i++) await tx.insert(equipment).values({ locationId: location.id, name: `Fridge ${i + 1}`, type: "Food fridge", preferredTemperature: 5, maximumTemperature: 8, order: i, active: true }); await audit(tx, location.id, context.user.id, "fridge_count_changed", `Active fridges set to ${count}`); return { count }; });
}

export async function addProbe(context: AuthContext, input: any) { const name = text(input.name, "Name"); const minimumTemperature = finite(input.minimumTemperature, "minimumTemperature"); const holdMinutes = finite(input.holdMinutes, "holdMinutes"); if (!Number.isInteger(holdMinutes) || holdMinutes < 1) throw new ApiError(422, "holdMinutes must be a positive whole number"); const locationIds = input.locationIds; if (!Array.isArray(locationIds) || !locationIds.length) throw new ApiError(422, "At least one location is required"); for (const locationId of locationIds) await locationFor(context, locationId); const [org] = await db().select({ organisationId: locations.organisationId }).from(locations).where(eq(locations.id, locationIds[0])).limit(1); if (!org) throw new ApiError(404, "Location not found"); return db().insert(probeProducts).values({ organisationId: org.organisationId, name, minimumTemperature, holdMinutes, locationIds, active: true }).returning(); }
export async function updateProbe(context: AuthContext, productId: string, input: any) { id(productId, "productId"); const [old] = await db().select().from(probeProducts).where(eq(probeProducts.id, productId)).limit(1); if (!old) throw new ApiError(404, "Probe product not found"); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); for (const locationId of old.locationIds ?? []) await locationFor(context, locationId); const name = text(input.name, "Name"); const minimumTemperature = finite(input.minimumTemperature, "minimumTemperature"); const holdMinutes = finite(input.holdMinutes, "holdMinutes"); if (!Number.isInteger(holdMinutes) || holdMinutes < 1) throw new ApiError(422, "holdMinutes must be a positive whole number"); return db().transaction(async tx => { const at = new Date(); await tx.update(probeProducts).set({ active: false, deactivatedAt: at }).where(eq(probeProducts.id, old.id)); const [row] = await tx.insert(probeProducts).values({ organisationId: old.organisationId, name, minimumTemperature, holdMinutes, locationIds: old.locationIds, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning(); await audit(tx, null, context.user.id, "probe_product_updated", name); return row; }); }
export async function deleteProbe(context: AuthContext, productId: string) { id(productId, "productId"); const [row] = await db().select().from(probeProducts).where(eq(probeProducts.id, productId)).limit(1); if (!row) throw new ApiError(404, "Probe product not found"); if (!row.active) throw new ApiError(409, "This configuration version is no longer active"); for (const locationId of row.locationIds ?? []) await locationFor(context, locationId); await db().update(probeProducts).set({ active: false, deactivatedAt: new Date() }).where(eq(probeProducts.id, row.id)); return { id: row.id, active: false }; }

async function checklistLocation(context: AuthContext, questionId: string) { id(questionId, "questionId"); const [row] = await db().select().from(checklistQuestions).where(eq(checklistQuestions.id, questionId)).limit(1); if (!row) throw new ApiError(404, "Question not found"); await locationFor(context, row.locationId); return row; }
export async function addChecklist(context: AuthContext, input: any) { const location = await locationFor(context, input.locationId); const checklist = requireEnum(input.checklist, "checklist", ["opening", "closing"] as const); const question = text(input.question, "Question"); const rows = await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, checklist))); const [row] = await db().insert(checklistQuestions).values({ locationId: location.id, checklist, question, order: rows.length, active: true }).returning(); return row; }
export async function updateChecklist(context: AuthContext, questionId: string, input: any) { const old = await checklistLocation(context, questionId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); const question = text(input.question, "Question"); return db().transaction(async tx => { const at = new Date(); await tx.update(checklistQuestions).set({ active: false, deactivatedAt: at }).where(eq(checklistQuestions.id, old.id)); const [row] = await tx.insert(checklistQuestions).values({ locationId: old.locationId, checklist: old.checklist, question, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning(); return row; }); }
export async function deleteChecklist(context: AuthContext, questionId: string) { const old = await checklistLocation(context, questionId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); await db().update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id)); return { id: old.id, active: false }; }
export async function reorderChecklist(context: AuthContext, questionId: string, direction: unknown) { const old = await checklistLocation(context, questionId); requireEnum(direction, "direction", ["up", "down"] as const); const rows = (await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, old.locationId), eq(checklistQuestions.checklist, old.checklist), eq(checklistQuestions.active, true)))).sort((a, b) => a.order - b.order); const i = rows.findIndex(r => r.id === old.id); const j = direction === "up" ? i - 1 : i + 1; if (i < 0 || !rows[j]) return old; return db().transaction(async tx => { await tx.update(checklistQuestions).set({ order: rows[j].order }).where(eq(checklistQuestions.id, rows[i].id)); await tx.update(checklistQuestions).set({ order: rows[i].order }).where(eq(checklistQuestions.id, rows[j].id)); return rows[i]; }); }

async function cleaningLocation(context: AuthContext, taskId: string) { id(taskId, "taskId"); const [row] = await db().select().from(cleaningTasks).where(eq(cleaningTasks.id, taskId)).limit(1); if (!row) throw new ApiError(404, "Cleaning task not found"); await locationFor(context, row.locationId); return row; }
const cleaningFrequency = (v: unknown) => requireEnum(v, "frequency", ["after_use", "daily", "weekly", "specific_days"] as const);
const weekdays = (v: unknown) => { if (!Array.isArray(v) || v.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new ApiError(400, "weekdays must contain values from 0 to 6"); return v as number[]; };
export async function addCleaning(context: AuthContext, input: any) { const location = await locationFor(context, input.locationId); const name = text(input.name, "Name"); const frequency = cleaningFrequency(input.frequency); const days = weekdays(input.weekdays ?? []); const rows = await db().select().from(cleaningTasks).where(eq(cleaningTasks.locationId, location.id)); const [row] = await db().insert(cleaningTasks).values({ locationId: location.id, name, frequency, weekdays: days, order: rows.length, active: true }).returning(); return row; }
export async function updateCleaning(context: AuthContext, taskId: string, input: any) { const old = await cleaningLocation(context, taskId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); const name = text(input.name, "Name"); const frequency = cleaningFrequency(input.frequency); const days = weekdays(input.weekdays ?? []); return db().transaction(async tx => { const at = new Date(); await tx.update(cleaningTasks).set({ active: false, deactivatedAt: at }).where(eq(cleaningTasks.id, old.id)); const [row] = await tx.insert(cleaningTasks).values({ locationId: old.locationId, name, frequency, weekdays: days, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning(); return row; }); }
export async function deleteCleaning(context: AuthContext, taskId: string) { const old = await cleaningLocation(context, taskId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); await db().update(cleaningTasks).set({ active: false, deactivatedAt: new Date() }).where(eq(cleaningTasks.id, old.id)); return { id: old.id, active: false }; }
export async function reorderCleaning(context: AuthContext, taskId: string, direction: unknown) { const old = await cleaningLocation(context, taskId); requireEnum(direction, "direction", ["up", "down"] as const); const rows = (await db().select().from(cleaningTasks).where(and(eq(cleaningTasks.locationId, old.locationId), eq(cleaningTasks.active, true)))).sort((a, b) => a.order - b.order); const i = rows.findIndex(r => r.id === old.id); const j = direction === "up" ? i - 1 : i + 1; if (i < 0 || !rows[j]) return old; return db().transaction(async tx => { await tx.update(cleaningTasks).set({ order: rows[j].order }).where(eq(cleaningTasks.id, rows[i].id)); await tx.update(cleaningTasks).set({ order: rows[i].order }).where(eq(cleaningTasks.id, rows[j].id)); return rows[i]; }); }

async function securityLocation(context: AuthContext, questionId: string) { id(questionId, "questionId"); const [row] = await db().select().from(securityQuestions).where(eq(securityQuestions.id, questionId)).limit(1); if (!row) throw new ApiError(404, "Question not found"); await locationFor(context, row.locationId); return row; }
export async function addSecurity(context: AuthContext, input: any) { const location = await locationFor(context, input.locationId); const session = requireEnum(input.session, "session", ["AM", "PM"] as const); const question = text(input.question, "Question"); const rows = await db().select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, session))); const [row] = await db().insert(securityQuestions).values({ locationId: location.id, session, question, order: rows.length, active: true }).returning(); return row; }
export async function updateSecurity(context: AuthContext, questionId: string, input: any) { const old = await securityLocation(context, questionId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); const question = text(input.question, "Question"); return db().transaction(async tx => { const at = new Date(); await tx.update(securityQuestions).set({ active: false, deactivatedAt: at }).where(eq(securityQuestions.id, old.id)); const [row] = await tx.insert(securityQuestions).values({ locationId: old.locationId, session: old.session, question, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning(); return row; }); }
export async function deleteSecurity(context: AuthContext, questionId: string) { const old = await securityLocation(context, questionId); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); await db().update(securityQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(securityQuestions.id, old.id)); return { id: old.id, active: false }; }

async function wastageLocation(context: AuthContext, itemId: string) { id(itemId, "itemId"); const [row] = await db().select().from(wastageItems).where(eq(wastageItems.id, itemId)).limit(1); if (!row) throw new ApiError(404, "Wastage item not found"); await locationFor(context, row.locationId); return row; }
export async function addWastage(context: AuthContext, input: any) { const location = await locationFor(context, input.locationId); const name = text(input.name, "Name"); const rows = await db().select().from(wastageItems).where(eq(wastageItems.locationId, location.id)); if (rows.some(r => r.active && r.name.trim().toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A wastage item with this name already exists"); const [row] = await db().insert(wastageItems).values({ locationId: location.id, name, order: rows.length, active: true }).returning(); return row; }
export async function updateWastage(context: AuthContext, itemId: string, input: any) { const old = await wastageLocation(context, itemId); if (!old.active) throw new ApiError(409, "Wastage item is inactive"); const name = text(input.name, "Name"); const rows = await db().select().from(wastageItems).where(eq(wastageItems.locationId, old.locationId)); if (rows.some(r => r.id !== old.id && r.active && r.name.trim().toLowerCase() === name.toLowerCase())) throw new ApiError(409, "A wastage item with this name already exists"); const [row] = await db().update(wastageItems).set({ name }).where(eq(wastageItems.id, old.id)).returning(); return row; }
export async function deleteWastage(context: AuthContext, itemId: string) { const old = await wastageLocation(context, itemId); if (!old.active) throw new ApiError(409, "Wastage item is inactive"); await db().update(wastageItems).set({ active: false }).where(eq(wastageItems.id, old.id)); return { id: old.id, active: false }; }
export async function reorderWastage(context: AuthContext, itemId: string, direction: unknown) { const old = await wastageLocation(context, itemId); requireEnum(direction, "direction", ["up", "down"] as const); const rows = (await db().select().from(wastageItems).where(and(eq(wastageItems.locationId, old.locationId), eq(wastageItems.active, true)))).sort((a, b) => a.order - b.order); const i = rows.findIndex(r => r.id === old.id); const j = direction === "up" ? i - 1 : i + 1; if (i < 0 || !rows[j]) return old; return db().transaction(async tx => { await tx.update(wastageItems).set({ order: rows[j].order }).where(eq(wastageItems.id, rows[i].id)); await tx.update(wastageItems).set({ order: rows[i].order }).where(eq(wastageItems.id, rows[j].id)); return rows[i]; }); }

export async function operations(context: AuthContext) {
  const orgId = context.user.organisationId; if (!orgId) throw new ApiError(403, "Access denied");
  const allowed = context.user.role === "admin" ? (await db().select().from(locations).where(and(eq(locations.organisationId, orgId), eq(locations.active, true)))) : (await db().select({ location: locations }).from(locations).innerJoin(memberships, eq(memberships.locationId, locations.id)).where(and(eq(memberships.userId, context.user.id), eq(memberships.role, "manager"), eq(locations.active, true)))); const seen = new Map<string, any>(); for (const row of allowed as any[]) { const location = row.location ?? row; if (!seen.has(location.id)) seen.set(location.id, location); }
  const result = []; for (const location of seen.values()) { const [taskRows, issueRows] = await Promise.all([db().select().from(scheduledTasks).where(eq(scheduledTasks.locationId, location.id)), db().select().from(issues).where(eq(issues.locationId, location.id))]); result.push({ location, teamMembers: await db().select().from(teamMembers).where(eq(teamMembers.locationId, location.id)), equipment: await db().select().from(equipment).where(and(eq(equipment.locationId, location.id), eq(equipment.active, true))), probeProducts: (await db().select().from(probeProducts)).filter(p => p.active && (p.locationIds ?? []).includes(location.id)), checklistQuestions: await db().select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.active, true))), securityQuestions: await db().select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.active, true))), cleaningTasks: await db().select().from(cleaningTasks).where(and(eq(cleaningTasks.locationId, location.id), eq(cleaningTasks.active, true))), wastageItems: await db().select().from(wastageItems).where(and(eq(wastageItems.locationId, location.id), eq(wastageItems.active, true))), scheduledTasks: taskRows, issues: issueRows.filter(issue => issue.status !== "resolved"), total: taskRows.length + 3, complete: taskRows.filter(task => task.status === "complete").length }); } return result;
}
