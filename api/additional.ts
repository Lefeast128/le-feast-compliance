import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { additionalDashboard } from "../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => additionalDashboard(context, getRouteParam(req, "locationId") ?? ""));
