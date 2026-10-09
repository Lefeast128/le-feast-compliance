import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { inspectionPack } from "../../../src/server/reports/inspection-pack.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => inspectionPack(context, {
  locationId: getRouteParam(req, "locationId") ?? "",
  start: getRouteParam(req, "start"),
  end: getRouteParam(req, "end"),
}));
