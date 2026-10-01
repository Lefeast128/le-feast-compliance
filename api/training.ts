import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { trainingDashboard } from "../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => trainingDashboard(context, getRouteParam(req, "locationId") ?? ""));
