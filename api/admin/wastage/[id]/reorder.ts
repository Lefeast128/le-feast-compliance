import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { reorderWastageCategory } from "../../../../src/server/management/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => reorderWastageCategory(context, getRouteParam(req, "id") ?? "", body.direction));
