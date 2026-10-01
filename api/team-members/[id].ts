import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { deleteTeamMember, updateTeamMember } from "../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteTeamMember(context, getRouteParam(req, "id") ?? "") : updateTeamMember(context, getRouteParam(req, "id") ?? "", body));
