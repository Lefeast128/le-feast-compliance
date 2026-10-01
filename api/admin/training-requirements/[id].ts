import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { deleteTraining, updateTraining } from "../../../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST", "DELETE"], (context, body) => req.method === "DELETE" ? deleteTraining(context, getRouteParam(req, "id") ?? "") : updateTraining(context, getRouteParam(req, "id") ?? "", body));
