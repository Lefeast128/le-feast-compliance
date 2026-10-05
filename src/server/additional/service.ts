/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq, lte } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { additionalCompletions, additionalRequirements, documents, issueUpdates, issues, locations, teamMembers } from "../db/schema.js";
import { requireLocationAccess, requireLocationManager, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireFiniteNumber, requireString, requireUuid } from "../compliance/validation.js";
import { localDateKey } from "../dashboard/time.js";

const frequencies = ["weekly", "monthly", "every_x_weeks", "every_x_months", "annual", "one_off"] as const;
const fieldTypes = ["temperature", "number", "yes_no", "completed", "date", "text", "actions", "pdf"] as const;
type Field = { key: string; label: string; type: string; minimum?: number; maximum?: number; options?: string[] };

const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value;
const dto = (row: any): any => row && Object.fromEntries(Object.entries(row).map(([key, value]) => [key, iso(value)]));
const completionDto = (row: any): any => { const value = dto(row); if (value) { delete value.documentStorageId; delete value.documentName; } return value; };

function validateFields(fields: Field[]) {
  if (!Array.isArray(fields) || !fields.length) throw new ApiError(422, "At least one field is required");
  const keys = new Set<string>();
  for (const field of fields) {
    if (!field || typeof field.key !== "string" || !field.key.trim()) throw new ApiError(422, "Field key is required");
    if (typeof field.label !== "string" || !field.label.trim()) throw new ApiError(422, "Field label is required");
    const key = field.key.trim(); if (keys.has(key)) throw new ApiError(422, `Duplicate field key: ${key}`); keys.add(key);
    if (!fieldTypes.includes(field.type as typeof fieldTypes[number])) throw new ApiError(422, `${field.label} has an invalid field type`);
    if (field.options?.length && field.type !== "actions") throw new ApiError(422, `${field.label} cannot have action options`);
    if (field.type === "actions" && field.options?.length) { const options = new Set<string>(); for (const option of field.options) { const value = option.trim(); if (!value) throw new ApiError(422, `${field.label} contains a blank action option`); if (options.has(value)) throw new ApiError(422, `${field.label} contains duplicate action options`); options.add(value); } }
    if ((field.type === "number" || field.type === "temperature") && field.minimum !== undefined && !Number.isFinite(field.minimum)) throw new ApiError(422, `${field.label} minimum must be a valid number`);
    if ((field.type === "number" || field.type === "temperature") && field.maximum !== undefined && !Number.isFinite(field.maximum)) throw new ApiError(422, `${field.label} maximum must be a valid number`);
    if (field.minimum !== undefined && field.maximum !== undefined && field.minimum > field.maximum) throw new ApiError(422, `${field.label} minimum cannot be greater than maximum`);
  }
  const canFail = fields.some(field => field.type === "yes_no" || ((field.type === "number" || field.type === "temperature") && (field.minimum !== undefined || field.maximum !== undefined)));
  if (canFail && !fields.some(field => field.type === "actions")) throw new ApiError(422, "A corrective action field is required for checks that can fail");
}

function validateInterval(frequency: string, interval: unknown) {
  if ((frequency === "every_x_weeks" || frequency === "every_x_months") && (typeof interval !== "number" || !Number.isInteger(interval) || interval < 1)) throw new ApiError(422, "Interval must be a whole number of at least 1");
}
function nextDue(frequency: string, interval: number | null, timestamp: Date) {
  const date = new Date(timestamp.getTime());
  if (frequency === "one_off") return date;
  if (frequency === "weekly") { date.setUTCDate(date.getUTCDate() + 7); return date; }
  if (frequency === "annual") { const day = date.getUTCDate(); const month = date.getUTCMonth(); date.setUTCDate(1); date.setUTCFullYear(date.getUTCFullYear() + 1); date.setUTCMonth(month); date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), month + 1, 0)).getUTCDate())); return date; }
  if (frequency === "monthly" || frequency === "every_x_months") { const months = frequency === "monthly" ? 1 : interval ?? 1; const day = date.getUTCDate(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + months); date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate())); return date; }
  date.setUTCDate(date.getUTCDate() + 7 * (frequency === "every_x_weeks" ? interval ?? 1 : 1)); return date;
}

async function locationFor(context: AuthContext, locationId: string, manager = false) {
  requireUuid(locationId, "locationId"); const [location] = await getDb().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found"); (manager ? requireLocationManager : requireLocationAccess)(context, location.id, location.organisationId); return location;
}
async function requirementFor(context: AuthContext, requirementId: string, manager = false) {
  requireUuid(requirementId, "requirementId"); const [requirement] = await getDb().select().from(additionalRequirements).where(eq(additionalRequirements.id, requirementId)).limit(1); if (!requirement) throw new ApiError(404, "Additional requirement not found"); await locationFor(context, requirement.locationId, manager); if (requirement.centralItemId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard additional checks are controlled centrally"); return requirement;
}

export async function additionalDashboard(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId); const db = getDb(); const now = Date.now(); const today = localDateKey(now, location.timezone);
  const [allRequirements, completions, members] = await Promise.all([
    db.select().from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)).orderBy(asc(additionalRequirements.order)),
    db.select().from(additionalCompletions).where(eq(additionalCompletions.locationId, location.id)),
    db.select().from(teamMembers).where(eq(teamMembers.locationId, location.id)),
  ]);
  const requirements = allRequirements.filter(item => item.active);
  const visible = requirements.filter(item => localDateKey(item.nextDueAt.getTime(), location.timezone) <= today || completions.some(completion => completion.requirementId === item.id && completion.completedAt && localDateKey(completion.completedAt.getTime(), location.timezone) === today));
  const roots = new Map(allRequirements.map(item => [item.id, item.versionRootId ?? item.id]));
  const data = completions.map(completion => ({ ...completionDto(completion), requirementRootId: roots.get(completion.requirementId) ?? completion.requirementId, teamMemberName: members.find(member => member.id === completion.teamMemberId)?.name, requirementTitle: allRequirements.find(item => item.id === completion.requirementId)?.title, documentUrl: completion.documentId ? `/api/documents/${completion.documentId}` : null }));
  return { location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone }, requirements: visible.map(dto), completions: data };
}

export async function additionalHistory(context: AuthContext, locationId: string, start: string, end: string) {
  const location = await locationFor(context, locationId); if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw new ApiError(400, "Date range is invalid");
  const rows = await getDb().select().from(additionalCompletions).where(and(eq(additionalCompletions.locationId, location.id), lte(additionalCompletions.completedAt, new Date(`${end}T23:59:59.999Z`))));
  const [requirements, members] = await Promise.all([getDb().select().from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)), getDb().select().from(teamMembers).where(eq(teamMembers.locationId, location.id))]);
  return rows.filter(row => { const key = localDateKey(row.completedAt.getTime(), location.timezone); return key >= start && key <= end; }).map(row => ({ ...completionDto(row), requirementTitle: requirements.find(requirement => requirement.id === row.requirementId)?.title, teamMemberName: members.find(member => member.id === row.teamMemberId)?.name, documentUrl: row.documentId ? `/api/documents/${row.documentId}` : null }));
}

export async function listAdditional(context: AuthContext, locationId: string) { const location = await locationFor(context, locationId, true); return getDb().select().from(additionalRequirements).where(and(eq(additionalRequirements.locationId, location.id), eq(additionalRequirements.active, true))).orderBy(asc(additionalRequirements.order)); }

function config(input: Record<string, unknown>) {
  const title = requireString(input.title, "Title"); const frequency = requireEnum(input.frequency, "frequency", frequencies); const nextDueAt = new Date(typeof input.nextDueAt === "string" || typeof input.nextDueAt === "number" ? input.nextDueAt : NaN); if (Number.isNaN(nextDueAt.getTime())) throw new ApiError(400, "Next due date must be valid"); const fields = input.fields as Field[]; validateFields(fields); validateInterval(frequency, input.interval); return { title, description: typeof input.description === "string" ? input.description.trim() : null, frequency, interval: input.interval === undefined ? null : requireFiniteNumber(input.interval, "interval"), nextDueAt, fields };
}
export async function addAdditional(context: AuthContext, input: Record<string, unknown>) { const location = await locationFor(context, requireString(input.locationId, "locationId"), true); const values = config(input); const rows = await getDb().select({ id: additionalRequirements.id }).from(additionalRequirements).where(eq(additionalRequirements.locationId, location.id)); const [row] = await getDb().insert(additionalRequirements).values({ locationId: location.id, ...values, order: rows.length, active: true }).returning(); return row; }
export async function updateAdditional(context: AuthContext, requirementId: string, input: Record<string, unknown>) { const old = await requirementFor(context, requirementId, true); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); const values = config(input); return getDb().transaction(async tx => { const [deactivated] = await tx.update(additionalRequirements).set({ active: false, deactivatedAt: new Date() }).where(eq(additionalRequirements.id, old.id)).returning(); const [row] = await tx.insert(additionalRequirements).values({ locationId: old.locationId, ...values, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id }).returning(); return { previous: deactivated, requirement: row }; }); }
export async function removeAdditional(context: AuthContext, requirementId: string) { const old = await requirementFor(context, requirementId, true); if (!old.active) throw new ApiError(409, "This configuration version is no longer active"); const [row] = await getDb().update(additionalRequirements).set({ active: false, deactivatedAt: new Date() }).where(eq(additionalRequirements.id, old.id)).returning(); return row; }
export async function reorderAdditional(context: AuthContext, requirementId: string, direction: unknown) { const old = await requirementFor(context, requirementId, true); if (direction !== "up" && direction !== "down") throw new ApiError(400, "direction is invalid"); const rows = (await getDb().select().from(additionalRequirements).where(and(eq(additionalRequirements.locationId, old.locationId), eq(additionalRequirements.active, true)))).sort((a, b) => a.order - b.order); const i = rows.findIndex(row => row.id === old.id); const j = direction === "up" ? i - 1 : i + 1; if (i < 0 || !rows[j]) return old; return getDb().transaction(async tx => { await tx.update(additionalRequirements).set({ order: rows[j].order }).where(eq(additionalRequirements.id, rows[i].id)); await tx.update(additionalRequirements).set({ order: rows[i].order }).where(eq(additionalRequirements.id, rows[j].id)); return rows[i]; }); }

export async function completeAdditional(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, requireString(input.locationId, "locationId")); const requirement = await requirementFor(context, requireString(input.requirementId, "requirementId")); if (requirement.locationId !== location.id || !requirement.active) throw new ApiError(422, "Additional requirement is not active for this location");
  const teamMemberId = requireString(input.teamMemberId, "teamMemberId"); requireUuid(teamMemberId, "teamMemberId"); const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.id, teamMemberId)).limit(1); if (!member || member.locationId !== location.id || !member.active) throw new ApiError(422, "Team member is inactive or belongs to another location");
  const answers = input.answers; if (!Array.isArray(answers)) throw new ApiError(400, "answers is required"); const fields = requirement.fields as Field[]; const configured = new Set(fields.map(field => field.key)); const answerMap = new Map<string, string>(); for (const answer of answers as any[]) { if (!answer || typeof answer.key !== "string" || typeof answer.value !== "string") throw new ApiError(400, "Answer is invalid"); if (!configured.has(answer.key)) throw new ApiError(422, "Answer does not belong to this requirement"); if (answerMap.has(answer.key)) throw new ApiError(422, "Duplicate answer"); answerMap.set(answer.key, answer.value.trim()); }
  const failed: { label: string; value: string; minimum?: number; maximum?: number }[] = []; let correctiveAction: string | undefined;
  for (const field of fields) { if (field.type === "pdf" || field.type === "actions") { if (field.type === "actions" && answerMap.get(field.key)) { const value = answerMap.get(field.key)!; if (field.options?.length && !field.options.includes(value)) throw new ApiError(422, `${field.label} must use a configured action`); correctiveAction ||= value; } continue; } const value = answerMap.get(field.key); if (!value) throw new ApiError(422, `${field.label} is required`); if (field.type === "yes_no" && value !== "yes" && value !== "no") throw new ApiError(422, `${field.label} must be Yes or No`); if (field.type === "completed" && value !== "completed") throw new ApiError(422, `${field.label} must be completed`); if (field.type === "number" || field.type === "temperature") { const numeric = Number(value); if (!Number.isFinite(numeric)) throw new ApiError(422, `${field.label} must be a valid number`); if (field.minimum !== undefined && numeric < field.minimum || field.maximum !== undefined && numeric > field.maximum) failed.push({ label: field.label, value, minimum: field.minimum, maximum: field.maximum }); } if (field.type === "date") { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError(422, `${field.label} must be a valid date`); const [year, month, day] = value.split("-").map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw new ApiError(422, `${field.label} must be a valid date`); } }
  if (fields.some(field => field.type === "yes_no" && answerMap.get(field.key) === "no")) failed.push(...fields.filter(field => field.type === "yes_no" && answerMap.get(field.key) === "no").map(field => ({ label: field.label, value: "no" })));
  const pdfField = fields.some(field => field.type === "pdf"); const documentId = pdfField ? requireUuid(input.documentId, "documentId") : undefined; if (pdfField && documentId) { const [document] = await getDb().select().from(documents).where(and(eq(documents.id, documentId), eq(documents.locationId, location.id), eq(documents.purpose, "additional_check_certificate"), eq(documents.status, "active"))).limit(1); if (!document) throw new ApiError(422, "PDF document is required"); }
  if (failed.length && !correctiveAction) throw new ApiError(422, "Corrective action is required for a failed additional check");
  const now = new Date(); if (localDateKey(requirement.nextDueAt.getTime(), location.timezone) > localDateKey(now.getTime(), location.timezone)) throw new ApiError(422, "This additional check is not due yet"); const due = nextDue(requirement.frequency, requirement.interval, requirement.nextDueAt); const storedAnswers = (answers as any[]).map(answer => ({ key: answer.key, value: answer.value.trim() }));
  return getDb().transaction(async tx => { const [completion] = await tx.insert(additionalCompletions).values({ locationId: location.id, requirementId: requirement.id, completedAt: now, nextDueAt: due, scheduledDueAt: requirement.nextDueAt, answers: storedAnswers, certificateReference: typeof input.certificateReference === "string" ? input.certificateReference.trim() : null, documentId: documentId ?? null, teamMemberId: member.id, completedBy: context.user.id }).returning(); let issue; if (failed.length) { const summary = failed.map(field => `${field.label}: ${field.value}${field.minimum !== undefined || field.maximum !== undefined ? ` (${[field.minimum !== undefined ? `minimum ${field.minimum}` : "", field.maximum !== undefined ? `maximum ${field.maximum}` : ""].filter(Boolean).join(", ")})` : ""}`).join("; "); [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Additional check", title: `${requirement.title} requires action`, description: summary, originalReading: summary, sourceAdditionalCompletionId: completion.id, status: "monitoring", action: correctiveAction!, createdAt: now, createdBy: context.user.id, teamMemberId: member.id }).returning(); await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: correctiveAction!, status: "monitoring", createdAt: now, createdBy: context.user.id, teamMemberId: member.id }); }
    if (requirement.frequency === "one_off") await tx.update(additionalRequirements).set({ active: false, deactivatedAt: now }).where(eq(additionalRequirements.id, requirement.id)); else await tx.update(additionalRequirements).set({ nextDueAt: due }).where(eq(additionalRequirements.id, requirement.id)); return { completion, issue };
  });
}
