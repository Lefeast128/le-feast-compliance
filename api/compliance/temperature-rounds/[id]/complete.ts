import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { completeRound } from "../../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => completeRound(context, { ...body, roundId: getRouteParam(req, "id") } as Parameters<typeof completeRound>[1]));
