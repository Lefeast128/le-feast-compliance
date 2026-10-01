import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { reorderAdditional } from "../../../../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => reorderAdditional(context, getRouteParam(req, "id") ?? "", body.direction));
