import { del, get, head, put } from "@vercel/blob";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { and, eq } from "drizzle-orm";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getDb } from "../db/client.js";
import { documents, locations } from "../db/schema.js";
import { requireLocationAccess, requireLocationManager, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { ApiError } from "../compliance/errors.js";
import { requireFiniteNumber, requireString, requireUuid } from "../compliance/validation.js";
import { MAX_PDF_BYTES } from "./pure.js";
import { decodeBase64, sanitizeFilename, validatePdfBytes } from "./validation.js";

export type DocumentPurpose = "training_document" | "additional_check_certificate" | "library_document";

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new ApiError(503, "Private document storage is not configured");
  return value;
}

const UPLOAD_TICKET_TTL_MS = 10 * 60 * 1000;

type UploadGrant = {
  pathname: string;
  locationId: string;
  purpose: DocumentPurpose;
  filename: string;
  contentType: "application/pdf";
  size: number;
  userId: string;
  expiresAt: number;
};

function uploadTicketSecret() {
  return process.env.AUTH_SESSION_SECRET ?? token();
}

function encodeTicket(grant: UploadGrant) {
  const payload = Buffer.from(JSON.stringify(grant)).toString("base64url");
  const signature = createHmac("sha256", uploadTicketSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function decodeTicket(value: unknown) {
  if (typeof value !== "string" || !value.includes(".")) throw new ApiError(400, "Upload authorization is invalid");
  const [payload, signature] = value.split(".");
  let expected: Buffer;
  try {
    expected = createHmac("sha256", uploadTicketSecret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("signature");
  } catch {
    throw new ApiError(400, "Upload authorization is invalid");
  }
  try {
    const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UploadGrant;
    if (!grant || grant.expiresAt <= Date.now()) throw new Error("expired");
    return grant;
  } catch {
    throw new ApiError(400, "Upload authorization is invalid or expired");
  }
}

function purposeValue(value: unknown) {
  if (value !== "training_document" && value !== "additional_check_certificate" && value !== "library_document") {
    throw new ApiError(400, "Document purpose is invalid");
  }
  return value as DocumentPurpose;
}

function uploadSize(value: unknown) {
  const size = requireFiniteNumber(value, "size");
  if (!Number.isInteger(size) || size <= 0 || size > MAX_PDF_BYTES) throw new ApiError(422, "PDF document size is invalid");
  return size;
}

async function authorizeUpload(context: AuthContext, input: Record<string, unknown>) {
  const purpose = purposeValue(input.purpose);
  const locationId = requireString(input.locationId, "locationId");
  const location = await locationFor(context, locationId, purpose === "training_document");
  if (purpose === "library_document") requireOrganisationAdmin(context, location.organisationId);
  const filename = sanitizeFilename(input.filename);
  if (input.contentType !== "application/pdf") throw new ApiError(422, "Only PDF documents are supported");
  const size = uploadSize(input.size);
  return { purpose, location, filename, size };
}

function grantMatches(grant: UploadGrant, input: Record<string, unknown>, context: AuthContext) {
  if (grant.userId !== context.user.id || grant.locationId !== input.locationId || grant.purpose !== input.purpose || grant.filename !== input.filename || grant.contentType !== input.contentType || grant.size !== input.size || grant.pathname !== input.pathname) {
    throw new ApiError(400, "Upload authorization is invalid");
  }
}

async function cleanupBlob(pathname: string) {
  try {
    await del(pathname, { token: token() });
  } catch {
    console.error("Document upload cleanup failed");
  }
}

async function locationFor(context: AuthContext, locationId: string, manager: boolean) {
  requireUuid(locationId, "locationId");
  const [location] = await getDb().select().from(locations).where(eq(locations.id, locationId)).limit(1);
  if (!location || !location.active) throw new ApiError(404, "Location not found");
  (manager ? requireLocationManager : requireLocationAccess)(context, location.id, location.organisationId);
  return location;
}

export async function createUploadGrant(context: AuthContext, input: Record<string, unknown>) {
  const { purpose, location, filename, size } = await authorizeUpload(context, input);
  const pathname = `compliance/${location.organisationId}/${location.id}/${purpose}/${randomUUID()}-${filename}`;
  const expiresAt = Date.now() + UPLOAD_TICKET_TTL_MS;
  const clientToken = await generateClientTokenFromReadWriteToken({
    token: token(),
    pathname,
    allowedContentTypes: ["application/pdf"],
    maximumSizeInBytes: MAX_PDF_BYTES,
    validUntil: expiresAt,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
  const grant: UploadGrant = { pathname, locationId: location.id, purpose, filename, contentType: "application/pdf", size, userId: context.user.id, expiresAt };
  return { clientToken, pathname, filename, finalizeToken: encodeTicket(grant), expiresAt };
}

async function validateStoredPdf(pathname: string, expectedSize: number) {
  const metadata = await head(pathname, { token: token() });
  if (metadata.size !== expectedSize || metadata.size > MAX_PDF_BYTES || metadata.contentType !== "application/pdf") throw new ApiError(422, "Uploaded file metadata is invalid");
  const stored = await get(pathname, { access: "private", token: token() });
  if (!stored) throw new ApiError(422, "Uploaded file is not available");
  if (!stored.stream) throw new ApiError(422, "Uploaded file is not available");
  const reader = stored.stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (length < 5) {
      const next = await reader.read();
      if (next.done) break;
      chunks.push(next.value);
      length += next.value.byteLength;
    }
  } finally {
    try { await reader.cancel(); } catch { /* best effort */ }
  }
  const prefix = new Uint8Array(Math.min(length, 5));
  let offset = 0;
  for (const chunk of chunks) {
    const copyLength = Math.min(chunk.byteLength, prefix.byteLength - offset);
    prefix.set(chunk.subarray(0, copyLength), offset);
    offset += copyLength;
    if (offset >= prefix.byteLength) break;
  }
  validatePdfBytes("application/pdf", prefix);
  return metadata;
}

export async function finalizeDocument(context: AuthContext, input: Record<string, unknown>) {
  const grant = decodeTicket(input.finalizeToken);
  grantMatches(grant, input, context);
  try {
    const location = await locationFor(context, grant.locationId, grant.purpose === "training_document");
    if (grant.purpose === "library_document") requireOrganisationAdmin(context, location.organisationId);
    const [existing] = await getDb().select().from(documents).where(eq(documents.pathname, grant.pathname)).limit(1);
    if (existing) return { id: existing.id, filename: existing.originalFilename, contentType: existing.contentType, size: existing.size };
    await validateStoredPdf(grant.pathname, grant.size);
    const [document] = await getDb().insert(documents).values({ organisationId: location.organisationId, locationId: grant.locationId, pathname: grant.pathname, originalFilename: grant.filename, contentType: "application/pdf", size: grant.size, purpose: grant.purpose, createdBy: context.user.id }).returning();
    return { id: document.id, filename: document.originalFilename, contentType: document.contentType, size: document.size };
  } catch (error) {
    let registered: typeof documents.$inferSelect | undefined;
    try {
      [registered] = await getDb().select().from(documents).where(eq(documents.pathname, grant.pathname)).limit(1);
    } catch {
      // Preserve the original registration failure and continue cleanup.
    }
    if (registered) return { id: registered.id, filename: registered.originalFilename, contentType: registered.contentType, size: registered.size };
    await cleanupBlob(grant.pathname);
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "Document upload could not be completed");
  }
}

export async function cleanupUpload(context: AuthContext, input: Record<string, unknown>) {
  const grant = decodeTicket(input.finalizeToken);
  grantMatches(grant, input, context);
  const location = await locationFor(context, grant.locationId, grant.purpose === "training_document");
  if (grant.purpose === "library_document") requireOrganisationAdmin(context, location.organisationId);
  await cleanupBlob(grant.pathname);
  return { cleaned: true };
}

export async function uploadDocument(context: AuthContext, input: Record<string, unknown>) {
  const purpose = purposeValue(input.purpose);
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
