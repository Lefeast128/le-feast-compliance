import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { reorderCleaning } from "../../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => reorderCleaning(context, getRouteParam(req, "id") ?? "", body.direction));
