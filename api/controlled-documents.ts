import { handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { listAccessibleControlledDocuments } from "../src/server/documents/controlled-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => {
  const locationId = Array.isArray(req.query?.locationId) ? req.query.locationId[0] : req.query?.locationId;
  return listAccessibleControlledDocuments(context, String(locationId ?? ""));
});
