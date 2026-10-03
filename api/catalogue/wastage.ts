import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { listWastageCatalogue } from "../../src/server/catalogue/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => listWastageCatalogue(context, getRouteParam(req, "locationId") ?? "", getRouteParam(req, "search")));
