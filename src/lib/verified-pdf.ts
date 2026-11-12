export async function readVerifiedPdf(response: Response, expectedDocumentId: string): Promise<Blob> {
  if (!expectedDocumentId || response.headers.get("X-Document-Id") !== expectedDocumentId) {
    throw new Error("The requested document could not be verified.");
  }
  if (!response.ok) throw new Error("This document is unavailable to your account.");
  const contentType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/pdf") throw new Error("The requested file is not a PDF.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const signature = new TextDecoder().decode(bytes.subarray(0, 5));
  if (signature !== "%PDF-") throw new Error("The document file could not be verified.");
  return new Blob([bytes], { type: "application/pdf" });
}
