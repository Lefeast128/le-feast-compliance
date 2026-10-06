import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, documents, libraryDocumentVersions, libraryDocuments, locations } from "../db/schema.js";
import { requireLocationAccess, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireString, requireUuid } from "../compliance/validation.js";
import { readPrivateDocument } from "../documents/service.js";

const LIBRARY_PURPOSE = "library_document";
const DEFAULT_CATEGORY = "other";

type AllocationInput = {
  allStores?: unknown;
  allocationMode?: unknown;
  locationIds?: unknown;
};

function allocationMode(input: AllocationInput): "all" | "selected" {
  if (input.allStores === true || input.allocationMode === "all") return "all";
  if (input.allStores === false || input.allocationMode === "selected") return "selected";
  return "selected";
}

async function organisationLocations(organisationId: string) {
  return getDb().select().from(locations).where(and(eq(locations.organisationId, organisationId), eq(locations.active, true))).orderBy(asc(locations.name));
}

async function selectedLocations(organisationId: string, input: AllocationInput) {
  const stores = await organisationLocations(organisationId);
  const mode = allocationMode(input);
  if (mode === "all") return { mode, stores };
  if (!Array.isArray(input.locationIds) || input.locationIds.length === 0 || input.locationIds.some(value => typeof value !== "string")) throw new ApiError(400, "Select at least one store");
  const ids = [...new Set(input.locationIds as string[])];
  const selected = stores.filter(store => ids.includes(store.id));
  if (selected.length !== ids.length) throw new ApiError(400, "Selected store is not available");
  return { mode, stores: selected };
}

async function libraryDocument(documentId: string, organisationId: string) {
  requireUuid(documentId, "documentId");
  const [document] = await getDb().select().from(documents).where(and(eq(documents.id, documentId), eq(documents.organisationId, organisationId), eq(documents.purpose, LIBRARY_PURPOSE), eq(documents.status, "active"))).limit(1);
  if (!document) throw new ApiError(400, "Library PDF not found");
  return document;
}

async function currentVersion(libraryDocumentId: string) {
  const [version] = await getDb().select({ version: libraryDocumentVersions, document: documents }).from(libraryDocumentVersions).innerJoin(documents, eq(documents.id, libraryDocumentVersions.documentId)).where(and(eq(libraryDocumentVersions.libraryDocumentId, libraryDocumentId), eq(documents.status, "active"))).orderBy(desc(libraryDocumentVersions.versionNumber)).limit(1);
  return version;
}

function documentStatus(store: typeof locations.$inferSelect, versionExists: boolean) {
  return { locationId: store.id, store: store.name, status: versionExists ? "attached" : "missing" } as const;
}

async function dto(row: typeof libraryDocuments.$inferSelect, stores: Array<typeof locations.$inferSelect>, includeInactive = false) {
  const version = await currentVersion(row.id);
  const visibleStores = row.allocationMode === "all" ? stores : stores.filter(store => row.locationIds.includes(store.id));
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    important: row.important,
    allocationMode: row.allocationMode,
    locationIds: row.locationIds,
    stores: visibleStores.map(store => store.name),
    active: row.active,
    updatedAt: row.updatedAt ?? row.createdAt,
    version: version?.version.versionNumber ?? 0,
    attachmentStatus: visibleStores.map(store => documentStatus(store, Boolean(version))),
    documentUrl: includeInactive && !row.active ? null : version && visibleStores[0] ? `/api/library/documents/${row.id}?locationId=${encodeURIComponent(visibleStores[0].id)}` : null,
  };
}

async function audit(context: AuthContext, type: string, detail: string) {
  await getDb().insert(auditEvents).values({ locationId: null, userId: context.user.id, type, detail, createdAt: new Date() });
}

export async function listLibrary(context: AuthContext, locationId: string) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(and(eq(locations.id, locationId), eq(locations.active, true))).limit(1);
  if (!location) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, location.id, location.organisationId);
  const rows = await getDb().select().from(libraryDocuments).where(and(eq(libraryDocuments.organisationId, location.organisationId), eq(libraryDocuments.active, true))).orderBy(desc(libraryDocuments.important), asc(libraryDocuments.category), asc(libraryDocuments.title));
  const applicable = rows.filter(row => row.allocationMode === "all" || row.locationIds.includes(location.id));
  const stores = [location];
  return { locationId: location.id, documents: await Promise.all(applicable.map(row => dto(row, stores))) };
}

export async function libraryDocumentForAccess(context: AuthContext, documentId: string, locationId: string) {
  requireUuid(documentId, "documentId");
  requireUuid(locationId, "locationId");
  const [row] = await getDb().select().from(libraryDocuments).where(and(eq(libraryDocuments.id, documentId), eq(libraryDocuments.active, true))).limit(1);
  if (!row) throw new ApiError(404, "Library document not found");
  const [location] = await getDb().select().from(locations).where(and(eq(locations.id, locationId), eq(locations.active, true))).limit(1);
  if (!location || location.organisationId !== row.organisationId) throw new ApiError(404, "Library document not found");
  requireLocationAccess(context, location.id, row.organisationId);
  if (row.allocationMode !== "all" && !row.locationIds.includes(location.id)) throw new ApiError(403, "Library document access denied");
  const version = await currentVersion(row.id);
  if (!version) throw new ApiError(404, "Library document not found");
  return version.document;
}

export async function listOrganisationLibrary(context: AuthContext) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Organisation admin access required");
  requireOrganisationAdmin(context, organisationId);
  const stores = await organisationLocations(organisationId);
  const rows = await getDb().select().from(libraryDocuments).where(eq(libraryDocuments.organisationId, organisationId)).orderBy(desc(libraryDocuments.active), desc(libraryDocuments.updatedAt), asc(libraryDocuments.title));
  return { locations: stores.map(store => ({ id: store.id, name: store.name, shortName: store.shortName })), documents: await Promise.all(rows.map(row => dto(row, stores, true))) };
}

export async function publishLibraryDocument(context: AuthContext, input: Record<string, unknown>) {
  const admin = requireOrganisationAdmin(context, context.user.organisationId ?? "");
  const title = requireString(input.title, "title").trim();
  const category = typeof input.category === "string" && input.category.trim() ? input.category.trim() : DEFAULT_CATEGORY;
  const documentId = requireString(input.documentId, "documentId");
  const document = await libraryDocument(documentId, admin.organisationId!);
  const selected = await selectedLocations(admin.organisationId!, input);
  const now = new Date();
  const db = getDb();
  const result = await db.transaction(async tx => {
    const [row] = await tx.insert(libraryDocuments).values({
      organisationId: admin.organisationId!,
      title,
      description: typeof input.description === "string" ? input.description : null,
      category,
      important: input.important === true,
      locationIds: selected.stores.map(store => store.id),
      allocationMode: selected.mode,
      createdBy: admin.id,
      createdAt: now,
      updatedAt: now,
      active: true,
    }).returning();
    const [version] = await tx.insert(libraryDocumentVersions).values({ libraryDocumentId: row.id, documentId: document.id, versionNumber: 1, createdBy: admin.id, createdAt: now }).returning();
    return { row, version };
  });
  await audit(context, "library_document_published", JSON.stringify({ title, category, allocationMode: selected.mode, stores: selected.stores.map(store => store.name) }));
  return { ...(await dto(result.row, selected.stores)), version: result.version.versionNumber };
}

async function existingLibraryDocument(context: AuthContext, id: string) {
  const admin = requireOrganisationAdmin(context, context.user.organisationId ?? "");
  requireUuid(id, "libraryDocumentId");
  const [row] = await getDb().select().from(libraryDocuments).where(and(eq(libraryDocuments.id, id), eq(libraryDocuments.organisationId, admin.organisationId!))).limit(1);
  if (!row) throw new ApiError(404, "Library document not found");
  return { admin, row };
}

export async function updateLibraryDocument(context: AuthContext, id: string, input: Record<string, unknown>) {
  const { admin, row } = await existingLibraryDocument(context, id);
  if (!row.active && input.retire !== false) throw new ApiError(400, "Library document is retired");
  if (input.retire === true) {
    await getDb().update(libraryDocuments).set({ active: false, updatedAt: new Date() }).where(eq(libraryDocuments.id, row.id));
    await audit(context, "library_document_retired", JSON.stringify({ title: row.title }));
    return { ok: true };
  }
  const selected = await selectedLocations(admin.organisationId!, input);
  const values = {
    title: typeof input.title === "string" && input.title.trim() ? input.title.trim() : row.title,
    description: typeof input.description === "string" ? input.description : row.description,
    category: typeof input.category === "string" && input.category.trim() ? input.category.trim() : row.category,
    important: typeof input.important === "boolean" ? input.important : row.important,
    locationIds: selected.stores.map(store => store.id),
    allocationMode: selected.mode,
    updatedAt: new Date(),
  } as const;
  await getDb().update(libraryDocuments).set(values).where(eq(libraryDocuments.id, row.id));
  const allocationChanged = row.allocationMode !== values.allocationMode || row.locationIds.length !== values.locationIds.length || row.locationIds.some(id => !values.locationIds.includes(id));
  await audit(context, allocationChanged ? "library_document_allocation_changed" : "library_document_updated", JSON.stringify({ title: values.title, allocationMode: values.allocationMode, stores: selected.stores.map(store => store.name) }));
  const [updated] = await getDb().select().from(libraryDocuments).where(eq(libraryDocuments.id, row.id)).limit(1);
  return dto(updated, selected.stores);
}

export async function replaceLibraryDocument(context: AuthContext, id: string, input: Record<string, unknown>) {
  const { admin, row } = await existingLibraryDocument(context, id);
  const document = await libraryDocument(requireString(input.documentId, "documentId"), admin.organisationId!);
  const [latest] = await getDb().select({ versionNumber: libraryDocumentVersions.versionNumber }).from(libraryDocumentVersions).where(eq(libraryDocumentVersions.libraryDocumentId, row.id)).orderBy(desc(libraryDocumentVersions.versionNumber)).limit(1);
  const versionNumber = (latest?.versionNumber ?? 0) + 1;
  await getDb().insert(libraryDocumentVersions).values({ libraryDocumentId: row.id, documentId: document.id, versionNumber, createdBy: admin.id });
  await getDb().update(libraryDocuments).set({ updatedAt: new Date(), active: true }).where(eq(libraryDocuments.id, row.id));
  await audit(context, "library_document_pdf_replaced", JSON.stringify({ title: row.title, versionNumber }));
  const stores = await organisationLocations(admin.organisationId!);
  return { ...(await dto({ ...row, active: true, updatedAt: new Date() }, stores, true)), version: versionNumber };
}

export async function readLibraryDocument(context: AuthContext, id: string, locationId: string) {
  return readPrivateDocument(await libraryDocumentForAccess(context, id, locationId));
}
