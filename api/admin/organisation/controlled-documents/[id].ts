import { handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { replaceControlledDocument, updateControlledDocument } from "../../../../src/server/documents/controlled-service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  if (req.method === "POST") return handleMutation(req, res, (context, body) => replaceControlledDocument(context, String(id ?? ""), body));
  return handleMutation(req, res, (context, body) => updateControlledDocument(context, String(id ?? ""), body));
};
