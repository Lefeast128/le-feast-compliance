import { handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { listLibrary } from "../src/server/library/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => {
  const locationId = Array.isArray(req.query?.locationId) ? req.query.locationId[0] : req.query?.locationId;
  return listLibrary(context, String(locationId ?? ""));
});
