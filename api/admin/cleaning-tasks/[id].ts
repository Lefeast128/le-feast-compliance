import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteCleaning, updateCleaning } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteCleaning(context, getRouteParam(req, "id") ?? "") : updateCleaning(context, getRouteParam(req, "id") ?? "", body));
