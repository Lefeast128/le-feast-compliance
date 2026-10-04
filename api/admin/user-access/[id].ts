import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { updateUserAccess } from "../../../src/server/management/user-access-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(
  req,
  res,
  ["PATCH"],
  (context, body) => updateUserAccess(context, getRouteParam(req, "id") ?? "", body),
);
