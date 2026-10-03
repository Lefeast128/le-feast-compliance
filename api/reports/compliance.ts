import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { complianceReport } from "../../src/server/reports/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => complianceReport(context, {
  locationId: getRouteParam(req, "locationId") ?? "",
  start: getRouteParam(req, "start"),
  end: getRouteParam(req, "end"),
}));

