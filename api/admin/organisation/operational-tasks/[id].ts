import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { updateCentralOperationalTask } from "../../../../src/server/management/organisation-service.js";
import { retireCentralOperationalTask } from "../../../../src/server/management/organisation-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST"], (context, body) => body.retire === true ? retireCentralOperationalTask(context, getRouteParam(req, "id") ?? "") : updateCentralOperationalTask(context, getRouteParam(req, "id") ?? "", body));
