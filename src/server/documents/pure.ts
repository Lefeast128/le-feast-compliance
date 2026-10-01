export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export function sanitizeFilenameValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Filename is required");
  const filename = value.trim().replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "");
  if (!filename || filename.length > 160) throw new Error("Filename is invalid");
  return filename;
}

export function validatePdfBytesValue(contentType: unknown, bytes: Uint8Array) {
  if (contentType !== "application/pdf") throw new Error("Only PDF documents are supported");
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) throw new Error("PDF document size is invalid");
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new Error("Uploaded file is not a valid PDF");
}
