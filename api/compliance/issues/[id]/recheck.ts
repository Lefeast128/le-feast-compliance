import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { addTemperatureRecheck } from "../../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addTemperatureRecheck(context, { ...body, issueId: getRouteParam(req, "id") } as Parameters<typeof addTemperatureRecheck>[1]));
