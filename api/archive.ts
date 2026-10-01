import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { archive } from "../src/server/history/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => archive(context, { locationId: getRouteParam(req, "locationId") ?? "", start: getRouteParam(req, "start") ?? "", end: getRouteParam(req, "end") ?? "" }));
