import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { requireLocationAccess, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireString, requireUuid } from "../compliance/validation.js";
import { getDb } from "../db/client.js";
import type { Transaction } from "../management/shared.js";
import {
  centralTrainingPublications,
  controlledDocumentVersions,
  controlledDocuments,
  auditEvents,
  documents,
  libraryDocumentVersions,
  libraryDocuments,
  locations,
  teamMembers,
  trainingCompletions,
  trainingDocumentVersions,
  trainingRequirements,
} from "../db/schema.js";

const dateOrNull = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") return null;
  const date = value instanceof Date ? value : new Date(requireString(value, label));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, `${label} is invalid`);
  return date;
};

function allocation(input: Record<string, unknown>) {
  return input.allStores === true || input.allocationMode === "all" ? "all" as const : "selected" as const;
}

async function storesFor(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  const stores = await getDb().select().from(locations).where(and(eq(locations.organisationId, organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
  if (allocation(input) === "all") return stores;
  if (!Array.isArray(input.locationIds) || input.locationIds.length === 0) throw new ApiError(400, "Select at least one store");
  const ids = [...new Set((input.locationIds as unknown[]).map((value: unknown) => requireUuid(value, "locationId")))];
  const selected = stores.filter(store => ids.includes(store.id));
  if (selected.length !== ids.length) throw new ApiError(403, "Selected store is not available");
  return selected;
}

async function sourceDocument(context: AuthContext, value: unknown) {
  const documentId = requireUuid(value, "documentId");
  const [document] = await getDb().select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organisationId, context.user.organisationId ?? ""), eq(documents.status, "active"))).limit(1);
  if (!document || document.contentType !== "application/pdf") throw new ApiError(404, "Controlled PDF not found");
  return document;
}

async function currentVersion(controlledDocumentId: string) {
  const [version] = await getDb().select().from(controlledDocumentVersions).where(eq(controlledDocumentVersions.controlledDocumentId, controlledDocumentId)).orderBy(desc(controlledDocumentVersions.versionNumber)).limit(1);
  return version;
}

async function dto(row: typeof controlledDocuments.$inferSelect, stores: Array<typeof locations.$inferSelect>) {
  const version = await currentVersion(row.id);
  const visible = row.allocationMode === "all" ? stores : stores.filter(store => row.locationIds.includes(store.id));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    allocationMode: row.allocationMode,
    locationIds: row.locationIds,
    stores: visible.map(store => ({ id: store.id, name: store.name, shortName: store.shortName })),
    displayInLibrary: row.displayInLibrary,
    requireTrainingAcknowledgement: row.requireTrainingAcknowledgement,
    acknowledgementDeadline: row.acknowledgementDeadline?.toISOString() ?? null,
    publicationDate: row.publicationDate?.toISOString() ?? null,
    reviewDate: row.reviewDate?.toISOString() ?? null,
    active: row.active,
    version: version?.versionNumber ?? 0,
    publishedAt: version?.publishedAt?.toISOString() ?? null,
  };
}

async function audit(context: AuthContext, type: string, detail: Record<string, unknown>) {
  await getDb().insert(auditEvents).values({ locationId: null, userId: context.user.id, type, detail: JSON.stringify(detail), createdAt: new Date() });
}

export async function listControlledDocuments(context: AuthContext) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  requireOrganisationAdmin(context, organisationId);
  const stores = await getDb().select().from(locations).where(and(eq(locations.organisationId, organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
  const rows = await getDb().select().from(controlledDocuments).where(eq(controlledDocuments.organisationId, organisationId)).orderBy(desc(controlledDocuments.active), asc(controlledDocuments.title));
  return { locations: stores.map(store => ({ id: store.id, name: store.name, shortName: store.shortName })), documents: await Promise.all(rows.map(row => dto(row, stores))) };
}

export async function listAccessibleControlledDocuments(context: AuthContext, locationId: string) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(and(eq(locations.id, locationId), eq(locations.active, true))).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, location.id, location.organisationId);
  const rows = await getDb().select().from(controlledDocuments).where(and(eq(controlledDocuments.organisationId, location.organisationId), eq(controlledDocuments.active, true), eq(controlledDocuments.requireTrainingAcknowledgement, true))).orderBy(asc(controlledDocuments.title));
  const applicable = rows.filter(row => row.allocationMode === "all" || row.locationIds.includes(location.id));
  return Promise.all(applicable.map(async row => ({ ...(await dto(row, [location])), acknowledgement: await controlledDocumentAcknowledgements(context, row.id, location.id) })));
}

export async function createControlledDocument(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  requireOrganisationAdmin(context, organisationId);
  const stores = await storesFor(context, input);
  const document = await sourceDocument(context, input.documentId);
  const title = requireString(input.title, "Title").trim();
  const category = requireString(input.category ?? "other", "Category").trim();
  if (!title || !category) throw new ApiError(400, "Title and category are required");
  const now = new Date();
  const publicationDate = dateOrNull(input.publicationDate, "Publication date") ?? now;
  const reviewDate = dateOrNull(input.reviewDate, "Review date");
  const acknowledgementDeadline = dateOrNull(input.acknowledgementDeadline, "Acknowledgement deadline");
  const displayInLibrary = input.displayInLibrary !== false;
  const requireTrainingAcknowledgement = input.requireTrainingAcknowledgement === true;
  const db = getDb();
  const row = await db.transaction(async tx => {
    const [controlled] = await tx.insert(controlledDocuments).values({ organisationId, title, description: typeof input.description === "string" ? input.description.trim() : null, category, locationIds: stores.map(store => store.id), allocationMode: allocation(input), displayInLibrary, requireTrainingAcknowledgement, acknowledgementDeadline, publicationDate, reviewDate, createdBy: context.user.id, createdAt: now, updatedAt: now, active: true }).returning();
    const [version] = await tx.insert(controlledDocumentVersions).values({ controlledDocumentId: controlled.id, documentId: document.id, versionNumber: 1, publishedAt: publicationDate, reviewDate, requiresReacknowledgement: true, createdBy: context.user.id, createdAt: now }).returning();
    if (displayInLibrary) {
      const [library] = await tx.insert(libraryDocuments).values({ organisationId, title, description: controlled.description, category, important: false, locationIds: controlled.locationIds, allocationMode: controlled.allocationMode, controlledDocumentId: controlled.id, createdBy: context.user.id, createdAt: now, updatedAt: now, active: true }).returning();
      await tx.insert(libraryDocumentVersions).values({ libraryDocumentId: library.id, documentId: document.id, controlledDocumentVersionId: version.id, versionNumber: 1, createdBy: context.user.id, createdAt: now });
    }
    if (requireTrainingAcknowledgement) await ensureTrainingPublication(tx, controlled, version, stores, context.user.id, now);
    return controlled;
  });
  await audit(context, "controlled_document_published", { controlledDocumentId: row.id, title, version: 1, storeCount: stores.length });
  return dto(row, stores);
}

async function ensureTrainingPublication(tx: Transaction, controlled: typeof controlledDocuments.$inferSelect, version: typeof controlledDocumentVersions.$inferSelect, stores: Array<typeof locations.$inferSelect>, userId: string, now: Date) {
  let [publication] = await tx.select().from(centralTrainingPublications).where(eq(centralTrainingPublications.controlledDocumentId, controlled.id)).limit(1);
  if (!publication) {
    [publication] = await tx.insert(centralTrainingPublications).values({ organisationId: controlled.organisationId, title: controlled.title, description: controlled.description, category: controlled.category, audience: "all_team", trainingFormat: "document", locationIds: stores.map(store => store.id), allocationMode: controlled.allocationMode, controlledDocumentId: controlled.id, createdBy: userId, createdAt: now, updatedAt: now, active: true }).returning();
  }
  const current = await tx.select().from(trainingRequirements).where(eq(trainingRequirements.centralPublicationId, publication.id));
  const selected = new Set(stores.map(store => store.id));
  for (const requirement of current) if (!selected.has(requirement.locationId)) await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.id, requirement.id));
  for (const store of stores) {
    let requirement = current.find((item: typeof trainingRequirements.$inferSelect) => item.locationId === store.id && item.active);
    if (!requirement) {
      const existing = await tx.select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, store.id));
      [requirement] = await tx.insert(trainingRequirements).values({ locationId: store.id, title: controlled.title, description: controlled.description, category: controlled.category, audience: "all_team", trainingFormat: "document", order: existing.length, active: true, centralPublicationId: publication.id }).returning();
    }
    if (requirement.currentDocumentVersionId) {
      const [currentVersionRow] = await tx.select({ controlledDocumentVersionId: trainingDocumentVersions.controlledDocumentVersionId }).from(trainingDocumentVersions).where(eq(trainingDocumentVersions.id, requirement.currentDocumentVersionId)).limit(1);
      if (currentVersionRow?.controlledDocumentVersionId === version.id) continue;
    }
    const [trainingVersion] = await tx.insert(trainingDocumentVersions).values({ requirementId: requirement.id, documentId: version.documentId, controlledDocumentVersionId: version.id, versionNumber: version.versionNumber, storageId: "controlled-document", documentName: controlled.title, createdBy: userId, createdAt: now, requiresReacknowledgement: true }).returning();
    await tx.update(trainingRequirements).set({ currentDocumentVersionId: trainingVersion.id, requiredDocumentVersionId: trainingVersion.id, documentStorageId: "controlled-document", documentName: controlled.title, trainingFormat: "document" }).where(eq(trainingRequirements.id, requirement.id));
  }
}

export async function replaceControlledDocument(context: AuthContext, id: string, input: Record<string, unknown>) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  requireOrganisationAdmin(context, organisationId);
  requireUuid(id, "controlledDocumentId");
  const [controlled] = await getDb().select().from(controlledDocuments).where(and(eq(controlledDocuments.id, id), eq(controlledDocuments.organisationId, organisationId), eq(controlledDocuments.active, true))).limit(1);
  if (!controlled) throw new ApiError(404, "Controlled document not found");
  const document = await sourceDocument(context, input.documentId);
  const stores = await storesFor(context, { locationIds: input.locationIds ?? controlled.locationIds, allocationMode: input.allocationMode ?? controlled.allocationMode });
  const latest = await currentVersion(controlled.id);
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  const publicationDate = dateOrNull(input.publicationDate, "Publication date") ?? new Date();
  const requireReacknowledgement = input.requireReacknowledgement !== false;
  await getDb().transaction(async tx => {
    const [version] = await tx.insert(controlledDocumentVersions).values({ controlledDocumentId: controlled.id, documentId: document.id, versionNumber, publishedAt: publicationDate, reviewDate: dateOrNull(input.reviewDate ?? controlled.reviewDate, "Review date"), requiresReacknowledgement: requireReacknowledgement, createdBy: context.user.id }).returning();
    await tx.update(controlledDocuments).set({ locationIds: stores.map(store => store.id), allocationMode: allocation({ allocationMode: input.allocationMode ?? controlled.allocationMode }), publicationDate, reviewDate: dateOrNull(input.reviewDate ?? controlled.reviewDate, "Review date"), updatedAt: new Date() }).where(eq(controlledDocuments.id, controlled.id));
    const [library] = await tx.select().from(libraryDocuments).where(eq(libraryDocuments.controlledDocumentId, controlled.id)).limit(1);
    if (library) {
      const libraryVersion = await tx.select({ versionNumber: libraryDocumentVersions.versionNumber }).from(libraryDocumentVersions).where(eq(libraryDocumentVersions.libraryDocumentId, library.id)).orderBy(desc(libraryDocumentVersions.versionNumber)).limit(1);
      await tx.insert(libraryDocumentVersions).values({ libraryDocumentId: library.id, documentId: document.id, controlledDocumentVersionId: version.id, versionNumber: Math.max(versionNumber, libraryVersion[0]?.versionNumber ?? 0) + (versionNumber === 1 ? 0 : 0), createdBy: context.user.id });
      await tx.update(libraryDocuments).set({ locationIds: stores.map(store => store.id), allocationMode: allocation({ allocationMode: input.allocationMode ?? controlled.allocationMode }), active: true, updatedAt: new Date() }).where(eq(libraryDocuments.id, library.id));
    }
    const [publication] = await tx.select().from(centralTrainingPublications).where(eq(centralTrainingPublications.controlledDocumentId, controlled.id)).limit(1);
    if (publication) {
      await ensureTrainingPublication(tx, { ...controlled, locationIds: stores.map(store => store.id), allocationMode: allocation({ allocationMode: input.allocationMode ?? controlled.allocationMode }) }, version, stores, context.user.id, new Date());
      await tx.update(centralTrainingPublications).set({ locationIds: stores.map(store => store.id), allocationMode: allocation({ allocationMode: input.allocationMode ?? controlled.allocationMode }), active: true, updatedAt: new Date() }).where(eq(centralTrainingPublications.id, publication.id));
    }
  });
  await audit(context, "controlled_document_version_published", { controlledDocumentId: id, version: versionNumber, requiresReacknowledgement: requireReacknowledgement });
  const [updated] = await getDb().select().from(controlledDocuments).where(eq(controlledDocuments.id, id));
  const storesAll = await getDb().select().from(locations).where(eq(locations.organisationId, organisationId));
  return dto(updated, storesAll);
}

export async function updateControlledDocument(context: AuthContext, id: string, input: Record<string, unknown>) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  requireOrganisationAdmin(context, organisationId);
  requireUuid(id, "controlledDocumentId");
  const [existing] = await getDb().select().from(controlledDocuments).where(and(eq(controlledDocuments.id, id), eq(controlledDocuments.organisationId, organisationId))).limit(1);
  if (!existing) throw new ApiError(404, "Controlled document not found");
  if (input.retire === true) {
    await getDb().transaction(async tx => {
      await tx.update(controlledDocuments).set({ active: false, updatedAt: new Date() }).where(eq(controlledDocuments.id, id));
      await tx.update(libraryDocuments).set({ active: false, updatedAt: new Date() }).where(eq(libraryDocuments.controlledDocumentId, id));
      const publications = await tx.select({ id: centralTrainingPublications.id }).from(centralTrainingPublications).where(eq(centralTrainingPublications.controlledDocumentId, id));
      for (const publication of publications) {
        await tx.update(centralTrainingPublications).set({ active: false, updatedAt: new Date() }).where(eq(centralTrainingPublications.id, publication.id));
        await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.centralPublicationId, publication.id));
      }
    });
    await audit(context, "controlled_document_retired", { controlledDocumentId: id });
    return { ok: true };
  }
  const stores = await storesFor(context, { locationIds: input.locationIds ?? existing.locationIds, allocationMode: input.allocationMode ?? existing.allocationMode });
  const patch: Partial<typeof controlledDocuments.$inferInsert> = { title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : existing.title, description: typeof input.description === "string" ? input.description.trim() : existing.description, category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : existing.category, locationIds: stores.map(store => store.id), allocationMode: allocation({ allocationMode: input.allocationMode ?? existing.allocationMode }), displayInLibrary: typeof input.displayInLibrary === "boolean" ? input.displayInLibrary : existing.displayInLibrary, requireTrainingAcknowledgement: typeof input.requireTrainingAcknowledgement === "boolean" ? input.requireTrainingAcknowledgement : existing.requireTrainingAcknowledgement, acknowledgementDeadline: input.acknowledgementDeadline === undefined ? existing.acknowledgementDeadline : dateOrNull(input.acknowledgementDeadline, "Acknowledgement deadline"), reviewDate: input.reviewDate === undefined ? existing.reviewDate : dateOrNull(input.reviewDate, "Review date"), updatedAt: new Date() };
  const [row] = await getDb().update(controlledDocuments).set(patch).where(eq(controlledDocuments.id, id)).returning();
  const latest = await currentVersion(id);
  await getDb().transaction(async tx => {
    const [library] = await tx.select().from(libraryDocuments).where(eq(libraryDocuments.controlledDocumentId, id)).limit(1);
    if (row.displayInLibrary && !library && latest) {
      const [created] = await tx.insert(libraryDocuments).values({ organisationId, title: row.title, description: row.description, category: row.category, important: false, locationIds: row.locationIds, allocationMode: row.allocationMode, controlledDocumentId: id, createdBy: context.user.id, createdAt: new Date(), updatedAt: new Date(), active: true }).returning();
      await tx.insert(libraryDocumentVersions).values({ libraryDocumentId: created.id, documentId: latest.documentId, controlledDocumentVersionId: latest.id, versionNumber: latest.versionNumber, createdBy: context.user.id });
    } else if (library) {
      await tx.update(libraryDocuments).set({ title: row.title, description: row.description, category: row.category, locationIds: row.locationIds, allocationMode: row.allocationMode, active: row.displayInLibrary, updatedAt: new Date() }).where(eq(libraryDocuments.id, library.id));
    }
    const [publication] = await tx.select().from(centralTrainingPublications).where(eq(centralTrainingPublications.controlledDocumentId, id)).limit(1);
    if (row.requireTrainingAcknowledgement && latest) {
      await ensureTrainingPublication(tx, row, latest, stores, context.user.id, new Date());
      if (publication) await tx.update(centralTrainingPublications).set({ title: row.title, description: row.description, category: row.category, locationIds: row.locationIds, allocationMode: row.allocationMode, active: true, updatedAt: new Date() }).where(eq(centralTrainingPublications.id, publication.id));
    } else if (publication) {
      await tx.update(centralTrainingPublications).set({ active: false, updatedAt: new Date() }).where(eq(centralTrainingPublications.id, publication.id));
      await tx.update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.centralPublicationId, publication.id));
    }
  });
  await audit(context, "controlled_document_updated", { controlledDocumentId: id, title: row.title });
  const storesAll = await getDb().select().from(locations).where(eq(locations.organisationId, organisationId));
  return dto(row, storesAll);
}

export async function controlledDocumentAcknowledgements(context: AuthContext, id: string, locationId?: string) {
  requireUuid(id, "controlledDocumentId");
  const [document] = await getDb().select().from(controlledDocuments).where(and(eq(controlledDocuments.id, id), eq(controlledDocuments.active, true))).limit(1);
  if (!document) throw new ApiError(404, "Controlled document not found");
  if (locationId) {
    requireUuid(locationId, "locationId");
    requireLocationAccess(context, locationId, document.organisationId);
    if (document.allocationMode !== "all" && !document.locationIds.includes(locationId)) throw new ApiError(403, "Controlled document access denied");
  } else if (context.user.role === "admin") {
    requireOrganisationAdmin(context, document.organisationId);
  } else throw new ApiError(400, "A store is required");
  const stores = await getDb().select().from(locations).where(and(eq(locations.organisationId, document.organisationId), eq(locations.active, true)));
  const allowed = locationId ? stores.filter(store => store.id === locationId) : stores.filter(store => document.allocationMode === "all" || document.locationIds.includes(store.id));
  const [publication] = await getDb().select().from(centralTrainingPublications).where(eq(centralTrainingPublications.controlledDocumentId, id)).limit(1);
  const version = await currentVersion(id);
  const members = allowed.length ? await getDb().select().from(teamMembers).where(inArray(teamMembers.locationId, allowed.map(store => store.id))) : [];
  const completions = publication ? await getDb().select({ completion: trainingCompletions, version: trainingDocumentVersions, requirement: trainingRequirements }).from(trainingCompletions).innerJoin(trainingDocumentVersions, eq(trainingDocumentVersions.id, trainingCompletions.documentVersionId)).innerJoin(trainingRequirements, eq(trainingRequirements.id, trainingCompletions.requirementId)).where(eq(trainingRequirements.centralPublicationId, publication.id)) : [];
  const deadline = document.acknowledgementDeadline?.getTime() ?? null;
  const resultStores = allowed.map(store => { const storeMembers = members.filter(member => member.locationId === store.id); return { id: store.id, name: store.name, acknowledged: storeMembers.map(member => ({ teamMemberId: member.id, name: member.name, completedAt: completions.find(item => item.completion.teamMemberId === member.id && item.completion.locationId === store.id && item.version.controlledDocumentVersionId === version?.id)?.completion.completedAt?.toISOString() ?? null })) }; });
  const assignments = resultStores.flatMap(store => store.acknowledged);
  const acknowledged = assignments.filter(member => member.completedAt).length;
  return { document: await dto(document, stores), version: version?.versionNumber ?? null, deadline: document.acknowledgementDeadline?.toISOString() ?? null, completionPercentage: assignments.length ? Math.round((acknowledged / assignments.length) * 100) : 0, overdue: deadline !== null && deadline < Date.now() && acknowledged < assignments.length, stores: resultStores };
}
