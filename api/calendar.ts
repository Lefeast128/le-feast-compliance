import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { calendar } from "../src/server/history/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => calendar(context, { locationId: getRouteParam(req, "locationId") ?? "", monthStart: getRouteParam(req, "monthStart") ?? "", monthEnd: getRouteParam(req, "monthEnd") ?? "" }));
