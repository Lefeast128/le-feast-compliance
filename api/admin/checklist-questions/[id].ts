import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteChecklist, updateChecklist } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteChecklist(context, getRouteParam(req, "id") ?? "") : updateChecklist(context, getRouteParam(req, "id") ?? "", body));
