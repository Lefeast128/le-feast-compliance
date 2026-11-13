import { handleQuery, type ApiRequest, type ApiResponse } from "../../../../../src/server/compliance/http.js";
import { controlledDocumentAcknowledgements } from "../../../../../src/server/documents/controlled-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => {
  const id = Array.isArray(req.query?.id) ? req.query.id[0] : req.query?.id;
  const locationId = Array.isArray(req.query?.locationId) ? req.query.locationId[0] : req.query?.locationId;
  return controlledDocumentAcknowledgements(context, String(id ?? ""), typeof locationId === "string" ? locationId : undefined);
});
