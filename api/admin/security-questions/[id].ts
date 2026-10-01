import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteSecurity, updateSecurity } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteSecurity(context, getRouteParam(req, "id") ?? "") : updateSecurity(context, getRouteParam(req, "id") ?? "", body));
