import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { refreshCatalogue } from "../../src/server/catalogue/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => refreshCatalogue(context, String(body.locationId ?? getRouteParam(req, "locationId") ?? "")));
