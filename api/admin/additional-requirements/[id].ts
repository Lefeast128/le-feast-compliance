import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { removeAdditional, updateAdditional } from "../../../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? removeAdditional(context, getRouteParam(req, "id") ?? "") : updateAdditional(context, getRouteParam(req, "id") ?? "", body));
