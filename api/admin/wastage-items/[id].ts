import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteWastage, updateWastage } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteWastage(context, getRouteParam(req, "id") ?? "") : updateWastage(context, getRouteParam(req, "id") ?? "", body));
