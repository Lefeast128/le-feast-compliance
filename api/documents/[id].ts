import { documentForAccess, readPrivateDocument } from "../../src/server/documents/service.js";
import { requireContext, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "GET") { res.status(405).json({ ok: false, error: "Method not allowed" }); return; }
  try {
    const id = Array.isArray(req.query?.id) ? req.query?.id[0] : req.query?.id;
    const context = await requireContext(req);
    const document = await documentForAccess(context, String(id ?? ""));
    const result = await readPrivateDocument(document);
    const response = res as ApiResponse & { setHeader?: (name: string, value: string) => void; send?: (body: unknown) => void };
    response.setHeader?.("Content-Type", document.contentType);
    response.setHeader?.("Content-Disposition", `inline; filename="${document.originalFilename.replace(/"/g, "")}"`);
    response.send?.(Buffer.from(await new Response(result.stream).arrayBuffer()));
  } catch (error) {
    const status = error instanceof Error && error.message === "Authentication required" ? 401 : error instanceof Error && error.message === "Location access required" ? 403 : error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 500;
    res.status(status).json({ ok: false, error: status >= 500 ? "Unable to load document" : error instanceof Error ? error.message : "Unable to load document" });
  }
}
