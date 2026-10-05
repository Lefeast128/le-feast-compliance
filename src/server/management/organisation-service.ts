import { and, asc, eq, inArray } from "drizzle-orm";
import { requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";
import { centralChecklistItems, centralTrainingPublications, checklistQuestions, locations, trainingDocumentVersions, trainingRequirements } from "../db/schema.js";
import { audit, db } from "./shared.js";

const trainingCategories = ["northern_rail", "food_safety", "security", "equipment", "alcohol", "company_procedure", "other"] as const;
const trainingAudiences = ["all_team", "managers_only", "selected_people"] as const;

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

function publicationDto(row: typeof centralTrainingPublications.$inferSelect, storeNames: Map<string, string>, requirements: Array<typeof trainingRequirements.$inferSelect>, versions: Array<typeof trainingDocumentVersions.$inferSelect>) {
  const requirementIds = new Set(requirements.map(requirement => requirement.id));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    audience: row.audience,
    active: row.active,
    locationIds: row.locationIds,
    stores: (row.locationIds ?? []).map(id => storeNames.get(id)).filter((name): name is string => Boolean(name)),
    version: Math.max(1, ...versions.filter(version => requirementIds.has(version.requirementId)).map(version => version.versionNumber)),
    requirementIds: requirements.map(requirement => requirement.id),
    requirements: requirements.map(requirement => ({ id: requirement.id, locationId: requirement.locationId })),
  };
}

function checklistDto(row: typeof centralChecklistItems.$inferSelect, storeNames: Map<string, string>, storeRows: Array<typeof checklistQuestions.$inferSelect>) {
  return {
    id: row.id,
    question: row.question,
    checklist: row.checklist,
    active: row.active,
    locationIds: row.locationIds,
    stores: (row.locationIds ?? []).map(id => storeNames.get(id)).filter((name): name is string => Boolean(name)),
    rowIds: storeRows.map(item => item.id),
  };
}

export async function listOrganisationControls(context: AuthContext) {
  const organisationId = organisationIdFor(context);
  const storeRows = await db().select({ id: locations.id, name: locations.name, shortName: locations.shortName })
    .from(locations).where(and(eq(locations.organisationId, organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
  const names = new Map(storeRows.map(row => [row.id, row.name]));
  const [trainingRows, checklistRows] = await Promise.all([
    db().select().from(centralTrainingPublications).where(and(eq(centralTrainingPublications.organisationId, organisationId), eq(centralTrainingPublications.active, true))).orderBy(asc(centralTrainingPublications.title)),
    db().select().from(centralChecklistItems).where(and(eq(centralChecklistItems.organisationId, organisationId), eq(centralChecklistItems.active, true))).orderBy(asc(centralChecklistItems.question)),
  ]);
  const publicationIds = trainingRows.map(row => row.id);
  const centralIds = checklistRows.map(row => row.id);
  const [requirements, storeChecklistRows] = await Promise.all([
    publicationIds.length ? db().select().from(trainingRequirements).where(inArray(trainingRequirements.centralPublicationId, publicationIds)) : [],
    centralIds.length ? db().select().from(checklistQuestions).where(inArray(checklistQuestions.centralItemId, centralIds)) : [],
  ]);
  const requirementIds = requirements.map(requirement => requirement.id);
  const versions = requirementIds.length
    ? await db().select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.requirementId, requirementIds))
    : [];
  return {
    locations: storeRows,
    training: trainingRows.map(row => publicationDto(row, names, requirements.filter(item => item.centralPublicationId === row.id), versions)),
    checklists: checklistRows.map(row => checklistDto(row, names, storeChecklistRows.filter(item => item.centralItemId === row.id))),
  };
}

function trainingValues(input: Record<string, unknown>) {
  return {
    title: requireString(input.title, "Title"),
    description: textOrNull(input.description, "Description"),
    category: requireEnum(input.category ?? "other", "category", trainingCategories),
    audience: requireEnum(input.audience ?? "all_team", "audience", trainingAudiences),
  };
}

export async function publishCentralTraining(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const stores = await selectedLocations(context, input.locationIds, input.allStores === true);
  const values = trainingValues(input);
  const created = await db().transaction(async tx => {
    const [publication] = await tx.insert(centralTrainingPublications).values({ organisationId, ...values, locationIds: stores.map(store => store.id), createdBy: context.user.id, updatedAt: new Date(), active: true }).returning();
    const createdRequirements = [];
    for (const store of stores) {
      const existing = await tx.select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, store.id));
      const [requirement] = await tx.insert(trainingRequirements).values({ locationId: store.id, title: values.title, description: values.description, category: values.category, audience: values.audience, order: existing.length, active: true, centralPublicationId: publication.id }).returning();
      createdRequirements.push(requirement);
    }
    await audit(tx, null, context.user.id, "central_training_created", JSON.stringify({ publicationId: publication.id, locationIds: stores.map(store => store.id), title: values.title }));
    return { publication, requirements: createdRequirements };
  });
  return created;
}

export async function updateCentralTraining(context: AuthContext, publicationId: string, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  requireUuid(publicationId, "publicationId");
  const [existing] = await db().select().from(centralTrainingPublications).where(and(eq(centralTrainingPublications.id, publicationId), eq(centralTrainingPublications.organisationId, organisationId), eq(centralTrainingPublications.active, true))).limit(1);
  if (!existing) throw new ApiError(404, "Central training requirement not found");
  const stores = await selectedLocations(context, input.locationIds ?? existing.locationIds, input.allStores === true);
  const values = trainingValues({ ...existing, ...input });
  return db().transaction(async tx => {
    await tx.update(centralTrainingPublications).set({ ...values, locationIds: stores.map(store => store.id), updatedAt: new Date() }).where(eq(centralTrainingPublications.id, existing.id));
    const current = await tx.select().from(trainingRequirements).where(eq(trainingRequirements.centralPublicationId, existing.id));
    const selected = new Set(stores.map(store => store.id));
    for (const requirement of current) {
      if (!selected.has(requirement.locationId)) await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.id, requirement.id));
      else await tx.update(trainingRequirements).set({ title: values.title, description: values.description, category: values.category, audience: values.audience }).where(eq(trainingRequirements.id, requirement.id));
    }
    for (const store of stores.filter(item => !current.some(requirement => requirement.locationId === item.id && requirement.active))) {
      const rows = await tx.select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, store.id));
      await tx.insert(trainingRequirements).values({ locationId: store.id, title: values.title, description: values.description, category: values.category, audience: values.audience, order: rows.length, active: true, centralPublicationId: existing.id });
    }
    await audit(tx, null, context.user.id, "central_training_updated", JSON.stringify({ publicationId: existing.id, locationIds: stores.map(store => store.id), title: values.title }));
    return { id: existing.id, locationIds: stores.map(store => store.id), title: values.title };
  });
}

function checklistValues(input: Record<string, unknown>) {
  return { checklist: requireEnum(input.checklist, "checklist", ["opening", "closing"] as const), question: requireString(input.question, "Question") };
}

export async function publishCentralChecklist(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const stores = await selectedLocations(context, input.locationIds, input.allStores === true);
  const values = checklistValues(input);
  return db().transaction(async tx => {
    const [item] = await tx.insert(centralChecklistItems).values({ organisationId, ...values, locationIds: stores.map(store => store.id), createdBy: context.user.id, updatedAt: new Date(), active: true }).returning();
    const rows = [];
    for (const store of stores) {
      const existing = await tx.select({ id: checklistQuestions.id }).from(checklistQuestions).where(and(eq(checklistQuestions.locationId, store.id), eq(checklistQuestions.checklist, values.checklist), eq(checklistQuestions.active, true)));
      const [row] = await tx.insert(checklistQuestions).values({ locationId: store.id, checklist: values.checklist, question: values.question, order: existing.length, active: true, centralItemId: item.id }).returning();
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
  const stores = await selectedLocations(context, input.locationIds ?? existing.locationIds, input.allStores === true);
  const values = checklistValues({ checklist: input.checklist ?? existing.checklist, question: input.question ?? existing.question });
  return db().transaction(async tx => {
    await tx.update(centralChecklistItems).set({ ...values, locationIds: stores.map(store => store.id), updatedAt: new Date() }).where(eq(centralChecklistItems.id, existing.id));
    const current = await tx.select().from(checklistQuestions).where(eq(checklistQuestions.centralItemId, existing.id));
    const selected = new Set(stores.map(store => store.id));
    for (const old of current) {
      if (!selected.has(old.locationId)) {
        await tx.update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id));
      } else if (old.active && (old.question !== values.question || old.checklist !== values.checklist)) {
        await tx.update(checklistQuestions).set({ active: false, deactivatedAt: new Date() }).where(eq(checklistQuestions.id, old.id));
        await tx.insert(checklistQuestions).values({ locationId: old.locationId, checklist: values.checklist, question: values.question, order: old.order, active: true, versionRootId: old.versionRootId ?? old.id, centralItemId: existing.id });
      }
    }
    for (const store of stores.filter(item => !current.some(row => row.locationId === item.id && row.active))) {
      const rows = await tx.select({ id: checklistQuestions.id }).from(checklistQuestions).where(and(eq(checklistQuestions.locationId, store.id), eq(checklistQuestions.checklist, values.checklist), eq(checklistQuestions.active, true)));
      await tx.insert(checklistQuestions).values({ locationId: store.id, checklist: values.checklist, question: values.question, order: rows.length, active: true, centralItemId: existing.id });
    }
    await audit(tx, null, context.user.id, "central_checklist_updated", JSON.stringify({ centralItemId: existing.id, locationIds: stores.map(store => store.id) }));
    return { id: existing.id, locationIds: stores.map(store => store.id), question: values.question, checklist: values.checklist };
  });
}
