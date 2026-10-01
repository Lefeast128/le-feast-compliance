import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteProbe, updateProbe } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteProbe(context, getRouteParam(req, "id") ?? "") : updateProbe(context, getRouteParam(req, "id") ?? "", body));
