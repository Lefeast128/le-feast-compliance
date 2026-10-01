import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { reorderTraining } from "../../../../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => reorderTraining(context, getRouteParam(req, "id") ?? "", body.direction));
