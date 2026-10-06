import { handleQuery, handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { listOrganisationLibrary, publishLibraryDocument } from "../../../src/server/library/service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, listOrganisationLibrary);
  return handleMutation(req, res, publishLibraryDocument);
};
