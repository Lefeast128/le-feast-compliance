import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { additionalHistory } from "../../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => additionalHistory(context, getRouteParam(req, "locationId") ?? "", getRouteParam(req, "start") ?? "", getRouteParam(req, "end") ?? ""));
