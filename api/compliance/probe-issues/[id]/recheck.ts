import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { addProbeRecheck } from "../../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addProbeRecheck(context, { ...body, issueId: getRouteParam(req, "id") } as Parameters<typeof addProbeRecheck>[1]));
