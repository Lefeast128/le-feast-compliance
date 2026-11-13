import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { createControlledDocument, listControlledDocuments } from "../../../src/server/documents/controlled-service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, listControlledDocuments);
  return handleMutation(req, res, createControlledDocument);
};
