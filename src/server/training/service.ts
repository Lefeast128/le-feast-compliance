/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, centralTrainingPublications, documents, locations, teamMembers, trainingCompletions, trainingContentVersions, trainingDocumentVersions, trainingRequirements } from "../db/schema.js";
import { requireLocationAccess, requireLocationManager, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";

const categories = ["northern_rail", "food_safety", "security", "equipment", "alcohol", "company_procedure", "other"] as const;
const audiences = ["all_team", "managers_only", "selected_people"] as const;
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : value;

async function locationFor(context: AuthContext, locationId: string, manager = false) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  (manager ? requireLocationManager : requireLocationAccess)(context, location.id, location.organisationId);
  return location;
}

const memberIdsFor = (members: typeof teamMembers.$inferSelect[], audience: string, selected: string[]) => members
  .filter(member => audience === "managers_only" ? member.role === "manager" : audience === "selected_people" ? selected.includes(member.id) : true)
  .map(member => member.id);

const dto = (row: any): any => row && Object.fromEntries(Object.entries(row).map(([key, value]) => [key, iso(value)]));
const versionDto = (row: any): any => row && ({ id: row.id, versionNumber: row.versionNumber, documentName: row.documentName, createdAt: iso(row.createdAt), requiresReacknowledgement: row.requiresReacknowledgement });

async function selectedMembers(context: AuthContext, locationId: string, selected: string[]) {
  const members = selected.length ? await getDb().select().from(teamMembers).where(and(eq(teamMembers.locationId, locationId), inArray(teamMembers.id, selected))) : [];
  if (members.length !== selected.length || members.some(member => !member.active)) throw new ApiError(422, "Selected team members must be active members of this location");
}

export async function trainingDashboard(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId);
  const db = getDb();
  const [requirements, members] = await Promise.all([
    db.select().from(trainingRequirements).where(and(eq(trainingRequirements.locationId, location.id), eq(trainingRequirements.active, true))).orderBy(asc(trainingRequirements.order)),
    db.select().from(teamMembers).where(and(eq(teamMembers.locationId, location.id), eq(teamMembers.active, true))).orderBy(asc(teamMembers.name)),
  ]);
  const requirementIds = requirements.map(item => item.id);
  const [versions, contentVersions, completions] = await Promise.all([
    requirementIds.length ? db.select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.requirementId, requirementIds)) : [],
    requirementIds.length ? db.select().from(trainingContentVersions).where(inArray(trainingContentVersions.requirementId, requirementIds)) : [],
    db.select().from(trainingCompletions).where(eq(trainingCompletions.locationId, location.id)),
  ]);
  const versionIds = [...new Set(requirements.flatMap(item => [item.currentDocumentVersionId, item.requiredDocumentVersionId]).concat(completions.map(item => item.documentVersionId)).filter((id): id is string => Boolean(id)))];
  const docs = versionIds.length ? await db.select().from(trainingDocumentVersions).where(inArray(trainingDocumentVersions.id, versionIds)) : [];
  const versionById = new Map([...versions, ...docs].map(item => [item.id, item]));
  const documentIds = [...new Set([...versions, ...docs].map(item => item.documentId).filter((id): id is string => Boolean(id)))];
  const documentRows = documentIds.length ? await db.select().from(documents).where(inArray(documents.id, documentIds)) : [];
  const documentById = new Map(documentRows.map(item => [item.id, item]));
  const requirementData = requirements.map(requirement => {
    const requirementVersions = versions.filter(version => version.requirementId === requirement.id).sort((a, b) => a.versionNumber - b.versionNumber);
    const requirementContentVersions = contentVersions.filter(version => version.requirementId === requirement.id).sort((a, b) => a.versionNumber - b.versionNumber);
    const current = requirement.currentDocumentVersionId ? versionById.get(requirement.currentDocumentVersionId) : undefined;
    const required = requirement.requiredDocumentVersionId ? versionById.get(requirement.requiredDocumentVersionId) : requirementVersions[0];
    const currentContent = requirement.currentContentVersionId ? contentVersions.find(version => version.id === requirement.currentContentVersionId) : undefined;
    const requiredContent = requirement.requiredContentVersionId ? contentVersions.find(version => version.id === requirement.requiredContentVersionId) : requirementContentVersions[0];
    const currentDocument = current?.documentId ? documentById.get(current.documentId) : undefined;
    const selected = Array.isArray(requirement.selectedTeamMemberIds) ? requirement.selectedTeamMemberIds : [];
    const audience = requirement.audience ?? "all_team";
    const requirementValue = dto(requirement);
    delete requirementValue.documentStorageId;
    delete requirementValue.documentName;
    return {
      ...requirementValue,
      trainingFormat: requirement.trainingFormat,
      trainingInstructions: currentContent?.content ?? requirement.description,
      applicableTeamMemberIds: memberIdsFor(members, audience, selected),
      currentDocumentVersion: versionDto(current ?? null),
      requiredDocumentVersion: versionDto(required ?? null),
      currentDocumentVersionNumber: current?.versionNumber,
      requiredDocumentVersionNumber: required?.versionNumber,
      currentContentVersionNumber: currentContent?.versionNumber,
      requiredContentVersionNumber: requiredContent?.versionNumber,
      documentUrl: requirement.trainingFormat === "document" && currentDocument ? `/api/documents/${currentDocument.id}` : null,
    };
  });
  const completionData = completions.map(completion => {
    const version = completion.documentVersionId ? versionById.get(completion.documentVersionId) : undefined;
    const contentVersion = completion.contentVersionId ? contentVersions.find(item => item.id === completion.contentVersionId) : undefined;
    return { id: completion.id, locationId: completion.locationId, requirementId: completion.requirementId, teamMemberId: completion.teamMemberId, completedAt: iso(completion.completedAt), completedBy: completion.completedBy, documentVersion: versionDto(version ?? null), documentVersionNumber: version?.versionNumber, contentVersionId: completion.contentVersionId, contentVersionNumber: contentVersion?.versionNumber, teamMemberName: members.find(member => member.id === completion.teamMemberId)?.name, requirementTitle: requirements.find(item => item.id === completion.requirementId)?.title };
  });
  return { location: { id: location.id, name: location.name, shortName: location.shortName, timezone: location.timezone }, teamMembers: members.map(dto), requirements: requirementData, completions: completionData };
}

export async function listTraining(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId, true);
  return getDb().select().from(trainingRequirements).where(and(eq(trainingRequirements.locationId, location.id), eq(trainingRequirements.active, true))).orderBy(asc(trainingRequirements.order));
}

function metadata(input: Record<string, unknown>) {
  const title = requireString(input.title, "Title");
  const description = input.description === undefined || input.description === null ? null : (typeof input.description === "string" ? input.description.trim() : (() => { throw new ApiError(400, "Description is invalid"); })());
  const category = requireEnum(input.category ?? "other", "category", categories);
  const audience = requireEnum(input.audience ?? "all_team", "audience", audiences);
  const trainingFormat = requireEnum(input.trainingFormat ?? "briefing", "trainingFormat", ["briefing", "document"] as const);
  const selectedTeamMemberIds = input.selectedTeamMemberIds ?? [];
  if (!Array.isArray(selectedTeamMemberIds) || selectedTeamMemberIds.some(item => typeof item !== "string")) throw new ApiError(400, "selectedTeamMemberIds is invalid");
  return { title, description, category, audience, trainingFormat, selectedTeamMemberIds: selectedTeamMemberIds as string[] };
}

export async function addTraining(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, requireString(input.locationId, "locationId"), true);
  const values = metadata(input);
  if (values.audience === "selected_people") await selectedMembers(context, location.id, values.selectedTeamMemberIds);
  const rows = await getDb().select({ id: trainingRequirements.id }).from(trainingRequirements).where(eq(trainingRequirements.locationId, location.id));
  const [row] = await getDb().insert(trainingRequirements).values({ locationId: location.id, ...values, order: rows.length, active: true }).returning();
  if (values.trainingFormat === "briefing") {
    const [version] = await getDb().insert(trainingContentVersions).values({ requirementId: row.id, versionNumber: 1, content: values.description ?? "", createdBy: context.user.id, requiresReacknowledgement: true }).returning();
    const [updated] = await getDb().update(trainingRequirements).set({ currentContentVersionId: version.id, requiredContentVersionId: version.id }).where(eq(trainingRequirements.id, row.id)).returning();
    return updated;
  }
  return row;
}

export async function updateTraining(context: AuthContext, requirementId: string, input: Record<string, unknown>) {
  requireUuid(requirementId, "requirementId");
  const [existing] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  if (!existing) throw new ApiError(404, "Training requirement not found");
  const location = await locationFor(context, existing.locationId, true);
  if (existing.centralPublicationId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard training is controlled centrally");
  if (!existing.active) throw new ApiError(409, "Training requirement is inactive");
  const values = metadata({ ...existing, ...input });
  if (values.audience === "selected_people") await selectedMembers(context, location.id, values.selectedTeamMemberIds);
  const [row] = await getDb().update(trainingRequirements).set(values).where(eq(trainingRequirements.id, existing.id)).returning();
  if (values.trainingFormat === "briefing" && existing.description !== values.description) {
    const versions = await getDb().select().from(trainingContentVersions).where(eq(trainingContentVersions.requirementId, existing.id));
    const [version] = await getDb().insert(trainingContentVersions).values({ requirementId: existing.id, versionNumber: Math.max(0, ...versions.map(item => item.versionNumber)) + 1, content: values.description ?? "", createdBy: context.user.id, requiresReacknowledgement: input.requireReacknowledgement === true }).returning();
    const versionPatch = input.requireReacknowledgement === true || !existing.requiredContentVersionId
      ? { currentContentVersionId: version.id, requiredContentVersionId: version.id }
      : { currentContentVersionId: version.id };
    await getDb().update(trainingRequirements).set(versionPatch).where(eq(trainingRequirements.id, existing.id));
  }
  return row;
}

export async function deleteTraining(context: AuthContext, requirementId: string) {
  requireUuid(requirementId, "requirementId");
  const [existing] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  if (!existing) throw new ApiError(404, "Training requirement not found");
  await locationFor(context, existing.locationId, true);
  if (existing.centralPublicationId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard training is controlled centrally");
  if (!existing.active) throw new ApiError(409, "Training requirement is inactive");
  const [row] = await getDb().update(trainingRequirements).set({ active: false }).where(eq(trainingRequirements.id, existing.id)).returning();
  return row;
}

export async function reorderTraining(context: AuthContext, requirementId: string, direction: unknown) {
  requireUuid(requirementId, "requirementId");
  if (direction !== "up" && direction !== "down") throw new ApiError(400, "direction is invalid");
  const [existing] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  if (!existing) throw new ApiError(404, "Training requirement not found");
  await locationFor(context, existing.locationId, true);
  const rows = (await getDb().select().from(trainingRequirements).where(and(eq(trainingRequirements.locationId, existing.locationId), eq(trainingRequirements.active, true)))).sort((a, b) => a.order - b.order);
  const i = rows.findIndex(row => row.id === existing.id); const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || !rows[j]) return existing;
  return getDb().transaction(async tx => { await tx.update(trainingRequirements).set({ order: rows[j].order }).where(eq(trainingRequirements.id, rows[i].id)); await tx.update(trainingRequirements).set({ order: rows[i].order }).where(eq(trainingRequirements.id, rows[j].id)); return rows[i]; });
}

export async function attachTrainingDocument(context: AuthContext, requirementId: string, documentId: string, input: Record<string, unknown>) {
  requireUuid(requirementId, "requirementId"); requireUuid(documentId, "documentId");
  const [requirement] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  if (!requirement) throw new ApiError(404, "Training requirement not found");
  const location = await locationFor(context, requirement.locationId, true);
  if (requirement.centralPublicationId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard training is controlled centrally");
  const [document] = await getDb().select().from(documents).where(and(eq(documents.id, documentId), eq(documents.locationId, location.id), eq(documents.purpose, "training_document"), eq(documents.status, "active"))).limit(1);
  if (!document) throw new ApiError(404, "Document not found");
  const requireReacknowledgement = input.requireReacknowledgement === true;
  return getDb().transaction(async tx => {
    const versions = await tx.select().from(trainingDocumentVersions).where(eq(trainingDocumentVersions.requirementId, requirement.id));
    const versionNumber = Math.max(0, ...versions.map(version => version.versionNumber)) + 1;
    const [version] = await tx.insert(trainingDocumentVersions).values({ requirementId: requirement.id, documentId: document.id, versionNumber, storageId: document.pathname, documentName: document.originalFilename, createdBy: context.user.id, requiresReacknowledgement: requireReacknowledgement }).returning();
    const baseline = requirement.requiredDocumentVersionId ?? versions.sort((a, b) => a.versionNumber - b.versionNumber)[0]?.id;
    const patch: any = { currentDocumentVersionId: version.id, documentStorageId: document.pathname, documentName: document.originalFilename, trainingFormat: "document" };
    if (!baseline || requireReacknowledgement) patch.requiredDocumentVersionId = version.id;
    const [updated] = await tx.update(trainingRequirements).set(patch).where(eq(trainingRequirements.id, requirement.id)).returning();
    if (requirement.centralPublicationId) {
      await tx.update(centralTrainingPublications).set({ trainingFormat: "document", updatedAt: new Date() }).where(eq(centralTrainingPublications.id, requirement.centralPublicationId));
      await tx.insert(auditEvents).values({ locationId: requirement.locationId, userId: context.user.id, type: "central_training_document_version_changed", detail: JSON.stringify({ publicationId: requirement.centralPublicationId, requirementId: requirement.id, versionNumber }), createdAt: new Date() });
    }
    return {
      requirement: {
        id: updated.id,
        locationId: updated.locationId,
        title: updated.title,
        trainingFormat: updated.trainingFormat,
        documentName: updated.documentName,
        currentDocumentVersionId: updated.currentDocumentVersionId,
        requiredDocumentVersionId: updated.requiredDocumentVersionId,
      },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        documentName: version.documentName,
        createdAt: iso(version.createdAt),
        requiresReacknowledgement: version.requiresReacknowledgement,
      },
    };
  });
}

export async function removeTrainingDocument(context: AuthContext, requirementId: string) {
  requireUuid(requirementId, "requirementId");
  const [requirement] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  if (!requirement) throw new ApiError(404, "Training requirement not found");
  await locationFor(context, requirement.locationId, true);
  if (requirement.centralPublicationId && context.user.role !== "admin") throw new ApiError(403, "Organisation standard training is controlled centrally");
  return getDb().transaction(async tx => {
    const requirements = requirement.centralPublicationId
      ? await tx.select().from(trainingRequirements).where(and(eq(trainingRequirements.centralPublicationId, requirement.centralPublicationId), eq(trainingRequirements.active, true)))
      : [requirement];
    const requirementIds = requirements.map(item => item.id);
    const [updated] = await tx.update(trainingRequirements)
      .set({ documentStorageId: null, documentName: null, currentDocumentVersionId: null, requiredDocumentVersionId: null, trainingFormat: "briefing" })
      .where(inArray(trainingRequirements.id, requirementIds))
      .returning();
    if (requirement.centralPublicationId) {
      await tx.update(centralTrainingPublications)
        .set({ trainingFormat: "briefing", updatedAt: new Date() })
        .where(eq(centralTrainingPublications.id, requirement.centralPublicationId));
      await tx.insert(auditEvents).values({
        locationId: null,
        userId: context.user.id,
        type: "central_training_document_removed",
        detail: JSON.stringify({ publicationId: requirement.centralPublicationId, locationIds: requirements.map(item => item.locationId) }),
        createdAt: new Date(),
      });
    }
    const result = requirements.find(item => item.id === requirement.id) ? await tx.select().from(trainingRequirements).where(eq(trainingRequirements.id, requirement.id)).limit(1) : [];
    const current = result[0] ?? updated;
    return {
      id: current.id,
      locationId: current.locationId,
      title: current.title,
      trainingFormat: current.trainingFormat,
      currentDocumentVersionId: current.currentDocumentVersionId,
      requiredDocumentVersionId: current.requiredDocumentVersionId,
    };
  });
}

export async function completeTraining(context: AuthContext, input: Record<string, unknown>) {
  const location = await locationFor(context, requireString(input.locationId, "locationId"));
  const requirementId = requireString(input.requirementId, "requirementId"); const teamMemberId = requireString(input.teamMemberId, "teamMemberId"); requireUuid(requirementId, "requirementId"); requireUuid(teamMemberId, "teamMemberId");
  const [requirement] = await getDb().select().from(trainingRequirements).where(eq(trainingRequirements.id, requirementId)).limit(1);
  const [member] = await getDb().select().from(teamMembers).where(eq(teamMembers.id, teamMemberId)).limit(1);
  if (!requirement || requirement.locationId !== location.id || !requirement.active) throw new ApiError(422, "Training requirement is not active for this location");
  if (!member || member.locationId !== location.id || !member.active) throw new ApiError(422, "Team member is inactive or belongs to another location");
  const audience = requirement.audience ?? "all_team"; const selected = Array.isArray(requirement.selectedTeamMemberIds) ? requirement.selectedTeamMemberIds : [];
  if ((audience === "managers_only" && member.role !== "manager") || (audience === "selected_people" && !selected.includes(member.id))) throw new ApiError(403, "Training requirement is not assigned to this team member");
  const current = requirement.currentDocumentVersionId ? (await getDb().select().from(trainingDocumentVersions).where(eq(trainingDocumentVersions.id, requirement.currentDocumentVersionId)).limit(1))[0] : undefined;
  const currentContent = requirement.currentContentVersionId ? (await getDb().select().from(trainingContentVersions).where(eq(trainingContentVersions.id, requirement.currentContentVersionId)).limit(1))[0] : undefined;
  const existing = await getDb().select().from(trainingCompletions).where(and(eq(trainingCompletions.requirementId, requirement.id), eq(trainingCompletions.teamMemberId, member.id), current ? eq(trainingCompletions.documentVersionId, current.id) : currentContent ? eq(trainingCompletions.contentVersionId, currentContent.id) : undefined as any)).limit(1);
  if (existing[0]) return existing[0];
  const [completion] = await getDb().insert(trainingCompletions).values({ locationId: location.id, requirementId: requirement.id, teamMemberId: member.id, documentVersionId: current?.id ?? null, contentVersionId: currentContent?.id ?? null, completedAt: new Date(), completedBy: context.user.id }).returning();
  return completion;
}
