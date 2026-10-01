import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { removeMembership } from "../../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["DELETE", "POST"], context => removeMembership(context, getRouteParam(req, "id") ?? ""));
