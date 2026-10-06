import { and, asc, desc, eq, inArray, like } from "drizzle-orm";
import { requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";
import { additionalRequirements, auditEvents, centralChecklistItems, centralOperationalItems, centralTrainingPublications, checklistQuestions, cleaningTasks, locations, securityQuestions, trainingContentVersions, trainingDocumentVersions, trainingRequirements, users } from "../db/schema.js";
import { audit, db, type Transaction } from "./shared.js";
import { validateStructuredSteps } from "../compliance/structured-task-service.js";
import { validateAdditionalSchedule } from "../additional/scheduling.js";

const trainingCategories = ["northern_rail", "food_safety", "security", "equipment", "alcohol", "company_procedure", "other"] as const;
const trainingAudiences = ["all_team", "managers_only", "selected_people"] as const;
const trainingFormats = ["briefing", "document"] as const;
const operationalKinds = ["opening", "closing", "cleaning", "security_am", "security_pm", "additional"] as const;
const additionalFrequencies = ["weekly", "monthly", "every_x_weeks", "every_x_months", "annual", "one_off"] as const;
const fieldTypes = ["temperature", "number", "yes_no", "completed", "date", "text", "actions", "pdf"] as const;

function organisationIdFor(context: AuthContext) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Access denied");
  requireOrganisationAdmin(context, organisationId);
  return organisationId;
}

async function selectedLocations(context: AuthContext, value: unknown, allStores = false) {
  const organisationId = organisationIdFor(context);
  const rows = await db().select({ id: locations.id, name: locations.name, shortName: locations.shortName })
    .from(locations)
    .where(and(eq(locations.organisationId, organisationId), eq(locations.active, true)))
    .orderBy(asc(locations.name));
  if (allStores) return rows;
  if (!Array.isArray(value) || !value.length) throw new ApiError(400, "At least one store is required");
  const ids = value.map(item => requireUuid(item, "locationId"));
  if (new Set(ids).size !== ids.length) throw new ApiError(400, "Store allocation contains a duplicate store");
  const selected = rows.filter(row => ids.includes(row.id));
  if (selected.length !== ids.length) throw new ApiError(400, "One or more stores are not available");
  return selected;
}

function textOrNull(input: unknown, label: string) {
  if (input === undefined || input === null || input === "") return null;
  return requireString(input, label);
}

function allocationMode(input: Record<string, unknown>, fallback: "all" | "selected" = "selected") {
  return input.allStores === true || input.allocationMode === "all" ? "all" : fallback;
}

function fieldDefinitions(input: unknown) {
  if (!Array.isArray(input) || !input.length) throw new ApiError(422, "At least one field is required");
  const keys = new Set<string>();
  for (const raw of input) {
    if (!raw || typeof raw !== "object") throw new ApiError(422, "Field definition is invalid");
    const field = raw as Record<string, unknown>;
    const key = typeof field.key === "string" ? field.key.trim() : "";
    const label = typeof field.label === "string" ? field.label.trim() : "";
    const type = field.type;
    if (!key || !label || typeof type !== "string" || !fieldTypes.includes(type as typeof fieldTypes[number])) throw new ApiError(422, "Field definition is invalid");
    if (keys.has(key)) throw new ApiError(422, "Duplicate field key");
    keys.add(key);
    if (type === "actions" && field.options !== undefined && (!Array.isArray(field.options) || field.options.some(option => typeof option !== "string" || !option.trim()))) throw new ApiError(422, "Action options are invalid");
    if ((type === "number" || type === "temperature") && field.minimum !== undefined && typeof field.minimum !== "number") throw new ApiError(422, "Field minimum is invalid");
    if ((type === "number" || type === "temperature") && field.maximum !== undefined && typeof field.maximum !== "number") throw new ApiError(422, "Field maximum is invalid");
    if (typeof field.minimum === "number" && typeof field.maximum === "number" && field.minimum > field.maximum) throw new ApiError(422, "Field minimum cannot be greater than maximum");
  }
  return input;
}

function publicationDto(row: typeof centralTrainingPublications.$inferSelect, storeNames: Map<string, string>, requirements: Array<typeof trainingRequirements.$inferSelect>, versions: Array<typeof trainingDocumentVersions.$inferSelect>, contentVersions: Array<typeof trainingContentVersions.$inferSelect>) {
  const requirementIds = new Set(requirements.map(requirement => requirement.id));
  const attachedVersionIds = new Set(versions.filter(version => requirementIds.has(version.requirementId) && Boolean(version.documentId)).map(version => version.id));
  const attachmentStatus = requirements.map(requirement => ({
    locationId: requirement.locationId,
    store: storeNames.get(requirement.locationId) ?? "Unknown store",
    status: requirement.currentDocumentVersionId && attachedVersionIds.has(requirement.currentDocumentVersionId) ? "attached" : "missing",
  }));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    audience: row.audience,
    trainingFormat: row.trainingFormat,
    active: row.active,
    allocationMode: row.allocationMode,
    locationIds: row.locationIds,
    stores: (row.locationIds ?? []).map(id => storeNames.get(id)).filter((name): name is string => Boolean(name)),
    version: Math.max(1, ...versions.filter(version => requirementIds.has(version.requirementId)).map(version => version.versionNumber), ...contentVersions.filter(version => requirementIds.has(version.requirementId)).map(version => version.versionNumber)),
    requirementIds: requirements.map(requirement => requirement.id),
    requirements: requirements.map(requirement => ({ id: requirement.id, locationId: requirement.locationId })),
    attachmentStatus,
  };
}

function checklistDto(row: typeof centralChecklistItems.$inferSelect, storeNames: Map<string, string>, storeRows: Array<typeof checklistQuestions.$inferSelect>) {
  return {
    id: row.id,
    question: row.question,
    description: row.description,
    taskType: row.taskType,
    steps: row.steps,
    checklist: row.checklist,
    active: row.active,
    allocationMode: row.allocationMode,
    locationIds: row.locationIds,
    stores: (row.locationIds ?? []).map(id => storeNames.get(id)).filter((name): name is string => Boolean(name)),
    rowIds: storeRows.map(item => item.id),
  };
}

function operationalDto(row: typeof centralOperationalItems.$inferSelect, storeNames: Map<string, string>) {
  return {
    id: row.id,
    kind: row.kind,
    checklist: row.checklist,
    session: row.session,
    name: row.name,
    question: row.question,
    description: row.description,
    taskType: row.taskType,
    steps: row.steps,
    frequency: row.frequency,
    interval: row.interval,
    weekdays: row.weekdays,
    dayOfMonth: row.dayOfMonth,
    nextDueAt: row.nextDueAt,
    fields: row.fields,
    active: row.active,
    allocationMode: row.allocationMode,
    locationIds: row.locationIds,
    stores: (row.locationIds ?? []).map(id => storeNames.get(id)).filter((name): name is string => Boolean(name)),
  };
}

function auditDto(row: { event: typeof auditEvents.$inferSelect; actor: string | null; email: string }) {
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse(row.event.detail) as Record<string, unknown>; } catch { /* old audit detail remains readable */ }
  const label = typeof detail.title === "string" ? detail.title : typeof detail.kind === "string" ? detail.kind : "organisation standard";
  const verb = row.event.type.replace(/^central_/, "").replace(/_/g, " ");
  return { at: row.event.createdAt, actor: row.actor ?? row.email, change: verb + ": " + label };
}

export async function listOrganisationControls(context: AuthContext) {
  const organisationId = organisationIdFor(context);
  const storeRows = await db().select({ id: locations.id, name: locations.name, shortName: locations.shortName })
    .from(locations).where(and(eq(locations.organisationId, organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
  const names = new Map(storeRows.map(row => [row.id, row.name]));
  const [trainingRows, checklistRows, operationalRows] = await Promise.all([
    db().select().from(centralTrainingPublications).where(and(eq(centralTrainingPublications.organisationId, organisationId), eq(centralTrainingPublications.active, true))).orderBy(asc(centralTrainingPublications.title)),
    db().select().from(centralChecklistItems).where(and(eq(centralChecklistItems.organisationId, organisationId), eq(centralChecklistItems.active, true))).orderBy(asc(centralChecklistItems.question)),
    db().select().from(centralOperationalItems).where(and(eq(centralOperationalItems.organisationId, organisationId), eq(centralOperationalItems.active, true))).orderBy(asc(centralOperationalItems.kind), asc(centralOperationalItems.name)),
  ]);
  const publicationIds = trainingRows.map(row => row.id);
  const centralIds = checklistRows.map(row => row.id);
  const [requirements, storeChecklistRows] = await Promise.all([
    publicationIds.length ? db().select().from(trainingRequirements).where(and(inArray(trainingRequirements.centralPublicationId, publicationIds), eq(trainingRequirements.active, true))) : [],
    centralIds.length ? db().select().from(checklistQuestions).where(inArray(checklistQuestions.centralItemId, centralIds)) : [],
  ]);
  const requirementIds = requirements.map(requirement => requirement.id);
  const versions = requirementIds.length
    ? await db().select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.requirementId, requirementIds))
    : [];
  const contentVersions = requirementIds.length
    ? await db().select().from(trainingContentVersions).where(inArray(trainingContentVersions.requirementId, requirementIds))
    : [];
  const recentChanges = await db().select({ event: auditEvents, actor: users.name, email: users.email })
    .from(auditEvents).innerJoin(users, eq(users.id, auditEvents.userId))
    .where(and(eq(users.organisationId, organisationId), like(auditEvents.type, "central_%"))).orderBy(desc(auditEvents.createdAt)).limit(20);
  return {
    locations: storeRows,
    training: trainingRows.map(row => publicationDto(row, names, requirements.filter(item => item.centralPublicationId === row.id), versions, contentVersions)),
    checklists: checklistRows.map(row => checklistDto(row, names, storeChecklistRows.filter(item => item.centralItemId === row.id))),
    operationalTasks: operationalRows.map(row => operationalDto(row, names)),
    recentChanges: recentChanges.map(auditDto),
  };
}

function trainingValues(input: Record<string, unknown>) {
  return {
    title: requireString(input.title, "Title"),
    description: textOrNull(input.description, "Description"),
    category: requireEnum(input.category ?? "other", "category", trainingCategories),
    audience: requireEnum(input.audience ?? "all_team", "audience", trainingAudiences),
    trainingFormat: requireEnum(input.trainingFormat ?? "briefing", "trainingFormat", trainingFormats),
  };
}

function safeTrainingRequirements(requirements: Array<typeof trainingRequirements.$inferSelect>) {
  return requirements.map(requirement => ({
    id: requirement.id,
    locationId: requirement.locationId,
    attached: Boolean(requirement.currentDocumentVersionId && requirement.documentStorageId),
  }));
}

export async function publishCentralTraining(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const stores = await selectedLocations(context, input.locationIds, allocationMode(input) === "all");
  const values = trainingValues(input);
  if (values.trainingFormat === "document" && input.documentSelected !== true) throw new ApiError(422, "A PDF is required for document training");
  const created = await db().transaction(async tx => {
    const [publication] = await tx.insert(centralTrainingPublications).values({ organisationId, ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input), createdBy: context.user.id, updatedAt: new Date(), active: true }).returning();
    const createdRequirements = [];
    for (const store of stores) {
      const existing = await tx.select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, store.id));
      const [requirement] = await tx.insert(trainingRequirements).values({ locationId: store.id, title: values.title, description: values.description, category: values.category, audience: values.audience, trainingFormat: values.trainingFormat, order: existing.length, active: true, centralPublicationId: publication.id }).returning();
      if (values.trainingFormat === "briefing") {
        const [version] = await tx.insert(trainingContentVersions).values({ requirementId: requirement.id, versionNumber: 1, content: values.description ?? "", createdBy: context.user.id, requiresReacknowledgement: true }).returning();
        await tx.update(trainingRequirements).set({ currentContentVersionId: version.id, requiredContentVersionId: version.id }).where(eq(trainingRequirements.id, requirement.id));
      }
      createdRequirements.push(requirement);
    }
    await audit(tx, null, context.user.id, "central_training_created", JSON.stringify({ publicationId: publication.id, locationIds: stores.map(store => store.id), title: values.title }));
    return { publication: { id: publication.id, title: publication.title, trainingFormat: publication.trainingFormat }, requirements: safeTrainingRequirements(createdRequirements) };
  });
  return created;
}

export async function updateCentralTraining(context: AuthContext, publicationId: string, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  requireUuid(publicationId, "publicationId");
  const [existing] = await db().select().from(centralTrainingPublications).where(and(eq(centralTrainingPublications.id, publicationId), eq(centralTrainingPublications.organisationId, organisationId), eq(centralTrainingPublications.active, true))).limit(1);
  if (!existing) throw new ApiError(404, "Central training requirement not found");
  if (input.retire === true) return retireCentralTraining(context, publicationId);
  const stores = await selectedLocations(context, input.locationIds ?? existing.locationIds, allocationMode(input, existing.allocationMode) === "all");
  const values = trainingValues({ ...existing, ...input });
  const requireReacknowledgement = input.requireReacknowledgement === true;
  const currentRequirements = await db().select().from(trainingRequirements).where(and(eq(trainingRequirements.centralPublicationId, existing.id), eq(trainingRequirements.active, true)));
  if (values.trainingFormat === "document" && input.documentSelected !== true && stores.some(store => {
    const requirement = currentRequirements.find(item => item.locationId === store.id);
    return !requirement || !requirement.currentDocumentVersionId || !requirement.documentStorageId;
  })) throw new ApiError(422, "A PDF is required for every document training store");
  return db().transaction(async tx => {
    await tx.update(centralTrainingPublications).set({ ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input, existing.allocationMode), updatedAt: new Date() }).where(eq(centralTrainingPublications.id, existing.id));
    const current = await tx.select().from(trainingRequirements).where(eq(trainingRequirements.centralPublicationId, existing.id));
    const selected = new Set(stores.map(store => store.id));
    for (const requirement of current) {
      if (!selected.has(requirement.locationId)) await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.id, requirement.id));
      else {
        await tx.update(trainingRequirements).set({ title: values.title, description: values.description, category: values.category, audience: values.audience, trainingFormat: values.trainingFormat }).where(eq(trainingRequirements.id, requirement.id));
        if (values.trainingFormat === "briefing" && (requirement.description !== values.description || requirement.trainingFormat !== values.trainingFormat)) {
          const versions = await tx.select().from(trainingContentVersions).where(eq(trainingContentVersions.requirementId, requirement.id));
          const [version] = await tx.insert(trainingContentVersions).values({ requirementId: requirement.id, versionNumber: Math.max(0, ...versions.map(item => item.versionNumber)) + 1, content: values.description ?? "", createdBy: context.user.id, requiresReacknowledgement: requireReacknowledgement }).returning();
          const patch = requireReacknowledgement || !requirement.requiredContentVersionId ? { currentContentVersionId: version.id, requiredContentVersionId: version.id } : { currentContentVersionId: version.id };
          await tx.update(trainingRequirements).set(patch).where(eq(trainingRequirements.id, requirement.id));
        }
      }
    }
    for (const store of stores.filter(item => !current.some(requirement => requirement.locationId === item.id && requirement.active))) {
      const rows = await tx.select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, store.id));
      const [requirement] = await tx.insert(trainingRequirements).values({ locationId: store.id, title: values.title, description: values.description, category: values.category, audience: values.audience, trainingFormat: values.trainingFormat, order: rows.length, active: true, centralPublicationId: existing.id }).returning();
      if (values.trainingFormat === "briefing") {
        const [version] = await tx.insert(trainingContentVersions).values({ requirementId: requirement.id, versionNumber: 1, content: values.description ?? "", createdBy: context.user.id, requiresReacknowledgement: requireReacknowledgement }).returning();
        await tx.update(trainingRequirements).set({ currentContentVersionId: version.id, requiredContentVersionId: version.id }).where(eq(trainingRequirements.id, requirement.id));
      }
    }
    const previous = new Set(existing.locationIds ?? []);
    const selectedLocationIds = new Set(stores.map(store => store.id));
    for (const locationId of selectedLocationIds) if (!previous.has(locationId)) await audit(tx, locationId, context.user.id, "central_training_store_added", JSON.stringify({ publicationId: existing.id, locationId, title: values.title }));
    for (const locationId of previous) if (!selectedLocationIds.has(locationId)) await audit(tx, locationId, context.user.id, "central_training_store_removed", JSON.stringify({ publicationId: existing.id, locationId, title: values.title }));
    await audit(tx, null, context.user.id, "central_training_updated", JSON.stringify({ publicationId: existing.id, locationIds: stores.map(store => store.id), title: values.title }));
    const activeRequirements = await tx.select().from(trainingRequirements).where(and(eq(trainingRequirements.centralPublicationId, existing.id), eq(trainingRequirements.active, true)));
    return { id: existing.id, locationIds: stores.map(store => store.id), title: values.title, requirements: safeTrainingRequirements(activeRequirements) };
  });
}

function checklistValues(input: Record<string, unknown>) {
  const taskType = input.taskType === undefined ? "simple" : requireEnum(input.taskType, "taskType", ["simple", "with_steps"] as const);
  return {
    checklist: requireEnum(input.checklist, "checklist", ["opening", "closing"] as const),
    question: requireString(input.question, "Question"),
    description: textOrNull(input.description, "Description"),
    taskType,
    steps: validateStructuredSteps(input.steps, taskType),
  };
}

export async function publishCentralChecklist(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const stores = await selectedLocations(context, input.locationIds, allocationMode(input) === "all");
  const values = checklistValues(input);
  return db().transaction(async tx => {
    const [item] = await tx.insert(centralChecklistItems).values({ organisationId, ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input), createdBy: context.user.id, updatedAt: new Date(), active: true }).returning();
    const rows = [];
    for (const store of stores) {
      const existing = await tx.select({ id: checklistQuestions.id }).from(checklistQuestions).where(and(eq(checklistQuestions.locationId, store.id), eq(checklistQuestions.checklist, values.checklist), eq(checklistQuestions.active, true)));
      const [row] = await tx.insert(checklistQuestions).values({ locationId: store.id, checklist: values.checklist, question: values.question, description: values.description, taskType: values.taskType, steps: values.steps, order: existing.length, active: true, centralItemId: item.id }).returning();
      rows.push(row);
    }
    await audit(tx, null, context.user.id, "central_checklist_created", JSON.stringify({ centralItemId: item.id, locationIds: stores.map(store => store.id), checklist: values.checklist }));
    return { item, rows };
  });
}

export async function updateCentralChecklist(context: AuthContext, itemId: string, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  requireUuid(itemId, "centralItemId");
  const [existing] = await db().select().from(centralChecklistItems).where(and(eq(centralChecklistItems.id, itemId), eq(centralChecklistItems.organisationId, organisationId), eq(centralChecklistItems.active, true))).limit(1);
  if (!existing) throw new ApiError(404, "Central checklist item not found");
  if (input.retire === true) return retireCentralChecklist(context, itemId);
  const stores = await selectedLocations(context, input.locationIds ?? existing.locationIds, allocationMode(input, existing.allocationMode) === "all");
  const values = checklistValues({ checklist: input.checklist ?? existing.checklist, question: input.question ?? existing.question, description: input.description ?? existing.description, taskType: input.taskType ?? existing.taskType, steps: input.steps ?? existing.steps });
  return db().transaction(async tx => {
    await tx.update(centralChecklistItems).set({ ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input, existing.allocationMode), updatedAt: new Date() }).where(eq(centralChecklistItems.id, existing.id));
    const current = await tx.select().from(checklistQuestions).where(eq(checklistQuestions.centralItemId, existing.id));
    const selected = new Set(stores.map(store => store.id));
    for (const old of current) {
      if (!selected.has(old.locationId)) {
        await tx.update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id));
      } else if (old.active && (old.question !== values.question || old.checklist !== values.checklist || old.description !== values.description || old.taskType !== values.taskType || JSON.stringify(old.steps) !== JSON.stringify(values.steps))) {
        await tx.update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id));
        await tx.insert(checklistQuestions).values({ locationId: old.locationId, checklist: values.checklist, question: values.question, description: values.description, taskType: values.taskType, steps: values.steps, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id, centralItemId: existing.id });
      }
    }
    for (const store of stores.filter(item => !current.some(row => row.locationId === item.id && row.active))) {
      const rows = await tx.select({ id: checklistQuestions.id }).from(checklistQuestions).where(and(eq(checklistQuestions.locationId, store.id), eq(checklistQuestions.checklist, values.checklist), eq(checklistQuestions.active, true)));
      await tx.insert(checklistQuestions).values({ locationId: store.id, checklist: values.checklist, question: values.question, description: values.description, taskType: values.taskType, steps: values.steps, order: rows.length, active: true, centralItemId: existing.id });
    }
    const previous = new Set(existing.locationIds ?? []);
    const selectedLocationIds = new Set(stores.map(store => store.id));
    for (const locationId of selectedLocationIds) if (!previous.has(locationId)) await audit(tx, locationId, context.user.id, "central_checklist_store_added", JSON.stringify({ centralItemId: existing.id, locationId }));
    for (const locationId of previous) if (!selectedLocationIds.has(locationId)) await audit(tx, locationId, context.user.id, "central_checklist_store_removed", JSON.stringify({ centralItemId: existing.id, locationId }));
    await audit(tx, null, context.user.id, "central_checklist_updated", JSON.stringify({ centralItemId: existing.id, locationIds: stores.map(store => store.id) }));
    return { id: existing.id, locationIds: stores.map(store => store.id), question: values.question, checklist: values.checklist };
  });
}

export async function retireCentralTraining(context: AuthContext, publicationId: string) {
  const organisationId = organisationIdFor(context);
  requireUuid(publicationId, "publicationId");
  const [existing] = await db().select().from(centralTrainingPublications).where(and(eq(centralTrainingPublications.id, publicationId), eq(centralTrainingPublications.organisationId, organisationId), eq(centralTrainingPublications.active, true))).limit(1);
  if (!existing) throw new ApiError(404, "Central training requirement not found");
  return db().transaction(async tx => {
    await tx.update(centralTrainingPublications).set({ active: false, updatedAt: new Date() }).where(eq(centralTrainingPublications.id, existing.id));
    await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.centralPublicationId, existing.id));
    await audit(tx, null, context.user.id, "central_training_retired", JSON.stringify({ publicationId: existing.id }));
    return { id: existing.id, active: false };
  });
}

export async function retireCentralChecklist(context: AuthContext, itemId: string) {
  const organisationId = organisationIdFor(context);
  requireUuid(itemId, "centralItemId");
  const [existing] = await db().select().from(centralChecklistItems).where(and(eq(centralChecklistItems.id, itemId), eq(centralChecklistItems.organisationId, organisationId), eq(centralChecklistItems.active, true))).limit(1);
  if (!existing) throw new ApiError(404, "Central checklist item not found");
  return db().transaction(async tx => {
    await tx.update(centralChecklistItems).set({ active: false, updatedAt: new Date() }).where(eq(centralChecklistItems.id, existing.id));
    await tx.update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.centralItemId, existing.id));
    await audit(tx, null, context.user.id, "central_checklist_retired", JSON.stringify({ centralItemId: existing.id }));
    return { id: existing.id, active: false };
  });
}

type OperationalKind = typeof operationalKinds[number];
type CentralOperationalInsert = typeof centralOperationalItems.$inferInsert;

function operationalKind(input: unknown): OperationalKind {
  return requireEnum(input, "kind", operationalKinds);
}

function operationalValues(input: Record<string, unknown>, kind: OperationalKind) {
  if (kind === "opening" || kind === "closing") {
    return { checklist: kind, question: requireString(input.question, "Question") };
  }
  if (kind === "cleaning") {
    const frequency = requireEnum(input.frequency, "frequency", ["after_use", "daily", "weekly", "specific_days"] as const);
    const weekdays = input.weekdays === undefined ? [] : input.weekdays;
    if (!Array.isArray(weekdays) || weekdays.some(day => !Number.isInteger(day) || Number(day) < 0 || Number(day) > 6)) throw new ApiError(400, "weekdays must contain values from 0 to 6");
    const taskType = input.taskType === undefined ? "simple" : requireEnum(input.taskType, "taskType", ["simple", "with_steps"] as const);
    return { name: requireString(input.name, "Name"), description: textOrNull(input.description, "Description"), taskType, steps: validateStructuredSteps(input.steps, taskType), frequency, weekdays: weekdays as number[] };
  }
  if (kind === "security_am" || kind === "security_pm") {
    const taskType = input.taskType === undefined ? "simple" : requireEnum(input.taskType, "taskType", ["simple", "with_steps"] as const);
    return { session: (kind === "security_am" ? "AM" : "PM") as "AM" | "PM", question: requireString(input.question, "Question"), description: textOrNull(input.description, "Description"), taskType, steps: validateStructuredSteps(input.steps, taskType) };
  }
  const frequency = requireEnum(input.frequency, "frequency", additionalFrequencies);
  const nextDueAt = new Date(typeof input.nextDueAt === "string" || typeof input.nextDueAt === "number" ? input.nextDueAt : NaN);
  if (Number.isNaN(nextDueAt.getTime())) throw new ApiError(400, "Next due date must be valid");
  const schedule = validateAdditionalSchedule({ frequency, interval: input.interval, weekdays: input.weekdays, nextDueAt, dayOfMonth: input.dayOfMonth });
  return {
    title: requireString(input.title, "Title"),
    description: textOrNull(input.description, "Description"),
    ...schedule,
    fields: fieldDefinitions(input.fields),
  };
}

async function operationalSource(context: AuthContext, centralItemId: string) {
  const organisationId = organisationIdFor(context);
  requireUuid(centralItemId, "centralItemId");
  const [row] = await db().select().from(centralOperationalItems).where(and(eq(centralOperationalItems.id, centralItemId), eq(centralOperationalItems.organisationId, organisationId), eq(centralOperationalItems.active, true))).limit(1);
  if (!row) throw new ApiError(404, "Central operational task not found");
  return row;
}

async function insertOperationalRow(tx: Transaction, kind: OperationalKind, locationId: string, sourceId: string, values: Record<string, unknown>, order: number, versionRootId?: string) {
  if (kind === "cleaning") {
    return tx.insert(cleaningTasks).values({ locationId, name: values.name, description: values.description, taskType: values.taskType, steps: values.steps, frequency: values.frequency, weekdays: values.weekdays, order, versionRootId, active: true, centralItemId: sourceId } as typeof cleaningTasks.$inferInsert).returning();
  }
  if (kind === "security_am" || kind === "security_pm") {
    return tx.insert(securityQuestions).values({ locationId, session: values.session, question: values.question, description: values.description, taskType: values.taskType, steps: values.steps, order, versionRootId, active: true, centralItemId: sourceId } as typeof securityQuestions.$inferInsert).returning();
  }
  return tx.insert(additionalRequirements).values({ locationId, title: values.title, description: values.description, frequency: values.frequency, interval: values.interval, weekdays: values.weekdays, dayOfMonth: values.dayOfMonth, nextDueAt: values.nextDueAt, fields: values.fields, order, versionRootId, active: true, centralItemId: sourceId } as typeof additionalRequirements.$inferInsert).returning();
}

function operationalChanged(kind: OperationalKind, row: Record<string, unknown>, values: Record<string, unknown>) {
  if (kind === "cleaning") return row.name !== values.name || row.description !== values.description || row.taskType !== values.taskType || JSON.stringify(row.steps) !== JSON.stringify(values.steps) || row.frequency !== values.frequency || JSON.stringify(row.weekdays) !== JSON.stringify(values.weekdays);
  if (kind === "security_am" || kind === "security_pm") return row.question !== values.question || row.description !== values.description || row.taskType !== values.taskType || JSON.stringify(row.steps) !== JSON.stringify(values.steps) || row.session !== values.session;
  return row.title !== values.title || row.description !== values.description || row.frequency !== values.frequency || row.interval !== values.interval || JSON.stringify(row.weekdays) !== JSON.stringify(values.weekdays) || row.dayOfMonth !== values.dayOfMonth || String(row.nextDueAt) !== String(values.nextDueAt) || JSON.stringify(row.fields) !== JSON.stringify(values.fields);
}

async function centralOperationalRows(kind: OperationalKind, sourceId: string, executor: Transaction | ReturnType<typeof db> = db()) {
  if (kind === "cleaning") return executor.select().from(cleaningTasks).where(eq(cleaningTasks.centralItemId, sourceId));
  if (kind === "security_am" || kind === "security_pm") return executor.select().from(securityQuestions).where(eq(securityQuestions.centralItemId, sourceId));
  return executor.select().from(additionalRequirements).where(eq(additionalRequirements.centralItemId, sourceId));
}

export async function publishCentralOperationalTask(context: AuthContext, input: Record<string, unknown>) {
  const kind = operationalKind(input.kind);
  if (kind === "opening" || kind === "closing") return publishCentralChecklist(context, { ...input, checklist: kind });
  const organisationId = organisationIdFor(context);
  const stores = await selectedLocations(context, input.locationIds, allocationMode(input) === "all");
  const values = operationalValues(input, kind);
  return db().transaction(async tx => {
    const [source] = await tx.insert(centralOperationalItems).values({ organisationId, kind, ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input), createdBy: context.user.id, active: true, updatedAt: new Date() } as CentralOperationalInsert).returning();
    const rows = [];
    for (const store of stores) {
      const existing = kind === "cleaning"
        ? await tx.select({ id: cleaningTasks.id }).from(cleaningTasks).where(eq(cleaningTasks.locationId, store.id))
        : kind === "security_am" || kind === "security_pm"
          ? await tx.select({ id: securityQuestions.id }).from(securityQuestions).where(eq(securityQuestions.locationId, store.id))
          : await tx.select({ id: additionalRequirements.id }).from(additionalRequirements).where(eq(additionalRequirements.locationId, store.id));
      const [row] = await insertOperationalRow(tx, kind, store.id, source.id, values, existing.length);
      rows.push(row);
    }
    const auditTitle = "name" in values ? values.name : "question" in values ? values.question : "title" in values ? values.title : undefined;
    await audit(tx, null, context.user.id, "central_operational_created", JSON.stringify({ centralItemId: source.id, kind, locationIds: stores.map(store => store.id), title: auditTitle }));
    return { source, rows };
  });
}

export async function updateCentralOperationalTask(context: AuthContext, centralItemId: string, input: Record<string, unknown>) {
  const source = await operationalSource(context, centralItemId);
  const kind = operationalKind(source.kind);
  if (kind === "opening" || kind === "closing") return updateCentralChecklist(context, centralItemId, { ...input, checklist: kind });
  const stores = await selectedLocations(context, input.locationIds ?? source.locationIds, allocationMode(input, source.allocationMode) === "all");
  const values = operationalValues({ ...source, ...input }, kind);
  return db().transaction(async tx => {
    await tx.update(centralOperationalItems).set({ ...values, locationIds: stores.map(store => store.id), allocationMode: allocationMode(input, source.allocationMode), updatedAt: new Date() } as Partial<CentralOperationalInsert>).where(eq(centralOperationalItems.id, source.id));
    const current = await centralOperationalRows(kind, source.id, tx);
    const selected = new Set(stores.map(store => store.id));
    for (const old of current as Array<Record<string, unknown>>) {
      if (!selected.has(String(old.locationId))) {
        await (kind === "cleaning" ? tx.update(cleaningTasks) : kind === "security_am" || kind === "security_pm" ? tx.update(securityQuestions) : tx.update(additionalRequirements)).set({ active: false, deactivatedAt: new Date() }).where(eq(kind === "cleaning" ? cleaningTasks.id : kind === "security_am" || kind === "security_pm" ? securityQuestions.id : additionalRequirements.id, String(old.id)));
      } else if (old.active && operationalChanged(kind, old, values)) {
        const table = kind === "cleaning" ? cleaningTasks : kind === "security_am" || kind === "security_pm" ? securityQuestions : additionalRequirements;
        await tx.update(table).set({ active: false, deactivatedAt: new Date() }).where(eq(table.id, String(old.id)));
        await insertOperationalRow(tx, kind, String(old.locationId), source.id, values, Number(old.order), String(old.versionRootId ?? old.id));
      }
    }
    for (const store of stores.filter(item => !(current as Array<Record<string, unknown>>).some(row => row.locationId === item.id && row.active))) {
      const existing = kind === "cleaning"
        ? await tx.select({ id: cleaningTasks.id }).from(cleaningTasks).where(eq(cleaningTasks.locationId, store.id))
        : kind === "security_am" || kind === "security_pm"
          ? await tx.select({ id: securityQuestions.id }).from(securityQuestions).where(eq(securityQuestions.locationId, store.id))
          : await tx.select({ id: additionalRequirements.id }).from(additionalRequirements).where(eq(additionalRequirements.locationId, store.id));
      await insertOperationalRow(tx, kind, store.id, source.id, values, existing.length);
    }
    const previous = new Set(source.locationIds ?? []);
    const currentLocations = new Set(stores.map(store => store.id));
    for (const locationId of currentLocations) if (!previous.has(locationId)) await audit(tx, locationId, context.user.id, "central_operational_store_added", JSON.stringify({ centralItemId: source.id, locationId, kind }));
    for (const locationId of previous) if (!currentLocations.has(locationId)) await audit(tx, locationId, context.user.id, "central_operational_store_removed", JSON.stringify({ centralItemId: source.id, locationId, kind }));
    await audit(tx, null, context.user.id, "central_operational_updated", JSON.stringify({ centralItemId: source.id, kind, locationIds: stores.map(store => store.id) }));
    return { id: source.id, kind, locationIds: stores.map(store => store.id) };
  });
}

export async function retireCentralOperationalTask(context: AuthContext, centralItemId: string) {
  const source = await operationalSource(context, centralItemId);
  const kind = operationalKind(source.kind);
  return db().transaction(async tx => {
    await tx.update(centralOperationalItems).set({ active: false, updatedAt: new Date() }).where(eq(centralOperationalItems.id, source.id));
    const table = kind === "cleaning" ? cleaningTasks : kind === "security_am" || kind === "security_pm" ? securityQuestions : additionalRequirements;
    await tx.update(table).set({ active: false, deactivatedAt: new Date() }).where(eq(table.centralItemId, source.id));
    await audit(tx, null, context.user.id, "central_operational_retired", JSON.stringify({ centralItemId: source.id, kind }));
    return { id: source.id, active: false };
  });
}
