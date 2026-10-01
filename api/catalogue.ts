import { getRouteParam, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { listCatalogue } from "../src/server/catalogue/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => listCatalogue(context, getRouteParam(req, "locationId") ?? ""));
