import { handleWrite, getRouteParam, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteWastageCategory, updateWastageCategory } from "../../../src/server/management/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "DELETE"], (context, body) => req.method === "DELETE"
  ? deleteWastageCategory(context, getRouteParam(req, "id") ?? "")
  : updateWastageCategory(context, getRouteParam(req, "id") ?? "", body));
