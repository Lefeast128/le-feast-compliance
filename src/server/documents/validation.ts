import { ApiError } from "../compliance/errors.js";
import { sanitizeFilenameValue, validatePdfBytesValue } from "./pure.js";

export { MAX_PDF_BYTES } from "./pure.js";

export function sanitizeFilename(value: unknown) {
  try { return sanitizeFilenameValue(value); } catch (error) { throw new ApiError(400, error instanceof Error ? error.message : "Filename is invalid"); }
}

export function validatePdfBytes(contentType: unknown, bytes: Uint8Array) {
  try { validatePdfBytesValue(contentType, bytes); } catch (error) { throw new ApiError(422, error instanceof Error ? error.message : "Uploaded file is invalid"); }
}

export function decodeBase64(value: unknown) {
  if (typeof value !== "string" || !value) throw new ApiError(400, "Document data is required");
  const encoded = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  try {
    return new Uint8Array(Buffer.from(encoded, "base64"));
  } catch {
    throw new ApiError(400, "Document data is invalid");
  }
}
