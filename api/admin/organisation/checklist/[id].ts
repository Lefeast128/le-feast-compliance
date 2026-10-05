import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { updateCentralChecklist } from "../../../../src/server/management/organisation-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST"], (context, body) => updateCentralChecklist(context, getRouteParam(req, "id") ?? "", body));
