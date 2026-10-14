import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteHandover } from "../../../src/server/management/shift-handover-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, context => deleteHandover(context, String(getRouteParam(req, "id") ?? "")));
