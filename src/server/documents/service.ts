import { del, get, put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../db/client.js";
import { documents, locations } from "../db/schema.js";
import { requireLocationAccess, requireLocationManager, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireString, requireUuid } from "../compliance/validation.js";
import { decodeBase64, sanitizeFilename, validatePdfBytes } from "./validation.js";

export type DocumentPurpose = "training_document" | "additional_check_certificate" | "library_document";

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new ApiError(503, "Private document storage is not configured");
  return value;
}

async function locationFor(context: AuthContext, locationId: string, manager: boolean) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  (manager ? requireLocationManager : requireLocationAccess)(context, location.id, location.organisationId);
  return location;
}

export async function uploadDocument(context: AuthContext, input: Record<string, unknown>) {
  const purpose = input.purpose;
  if (purpose !== "training_document" && purpose !== "additional_check_certificate" && purpose !== "library_document") throw new ApiError(400, "Document purpose is invalid");
  const locationId = requireString(input.locationId, "locationId");
  const location = await locationFor(context, locationId, purpose === "training_document");
  if (purpose === "library_document") requireOrganisationAdmin(context, location.organisationId);
  const filename = sanitizeFilename(input.filename);
  const bytes = decodeBase64(input.data);
  validatePdfBytes(input.contentType, bytes);
  const pathname = `compliance/${location.organisationId}/${location.id}/${purpose}/${randomUUID()}-${filename}`;
  let blob;
  try {
    blob = await put(pathname, Buffer.from(bytes), { access: "private", contentType: "application/pdf", token: token(), addRandomSuffix: false });
    const [document] = await getDb().insert(documents).values({ organisationId: location.organisationId, locationId: location.id, pathname, originalFilename: filename, contentType: "application/pdf", size: bytes.byteLength, purpose, createdBy: context.user.id }).returning();
    return { id: document.id, filename: document.originalFilename, contentType: document.contentType, size: document.size };
  } catch (error) {
    if (blob) {
      try { await del(blob.url, { token: token() }); } catch { /* best effort cleanup */ }
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Document storage is unavailable");
  }
}

export async function documentForAccess(context: AuthContext, documentId: string) {
  requireUuid(documentId, "documentId");
  const [document] = await getDb().select().from(documents).where(and(eq(documents.id, documentId), eq(documents.status, "active"))).limit(1);
  if (!document) throw new ApiError(404, "Document not found");
  await locationFor(context, document.locationId, false);
  return document;
}

export async function readPrivateDocument(document: typeof documents.$inferSelect) {
  try {
    const result = await get(document.pathname, { access: "private", token: token() });
    if (!result) throw new Error("missing");
    return result;
  } catch {
    throw new ApiError(404, "Document not found");
  }
}
