import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { updateEquipment } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST"], (context, body) => updateEquipment(context, getRouteParam(req, "id") ?? "", body));
