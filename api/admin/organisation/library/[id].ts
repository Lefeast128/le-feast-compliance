import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { replaceLibraryDocument, updateLibraryDocument } from "../../../../src/server/library/service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  const id = getRouteParam(req, "id") ?? "";
  if (req.method === "POST") return handleWrite(req, res, ["POST"], (context, body) => replaceLibraryDocument(context, id, body));
  return handleWrite(req, res, ["PATCH"], (context, body) => updateLibraryDocument(context, id, body));
};
