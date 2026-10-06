import { getRouteParam, requireContext, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { libraryDocumentForAccess, readLibraryDocument } from "../../../src/server/library/service.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
  try {
    const context = await requireContext(req);
    const id = getRouteParam(req, "id") ?? "";
    const locationId = getRouteParam(req, "locationId") ?? "";
    const document = await libraryDocumentForAccess(context, id, locationId);
    const result = await readLibraryDocument(context, id, locationId);
    const response = res as ApiResponse & { setHeader?: (name: string, value: string) => void; send?: (body: unknown) => void };
    response.setHeader?.("Content-Type", document.contentType);
    response.setHeader?.("Content-Disposition", `inline; filename="${document.originalFilename.replace(/"/g, "")}"`);
    response.send?.(Buffer.from(await new Response(result.stream).arrayBuffer()));
  } catch (error) {
    const status = error instanceof Error && error.message === "Authentication required" ? 401 : error instanceof Error && ["Location access required", "Library document access denied"].includes(error.message) ? 403 : error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 500;
    res.status(status).json({ ok: false, error: status >= 500 ? "Unable to load library document" : error instanceof Error ? error.message : "Unable to load library document" });
  }
}
