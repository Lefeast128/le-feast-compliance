import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { reorderWastage } from "../../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => reorderWastage(context, getRouteParam(req, "id") ?? "", body.direction));
