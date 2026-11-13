import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { resolveHandover } from "../../../src/server/management/shift-handover-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => resolveHandover(context, { ...body, noteId: getRouteParam(req, "id") } as Parameters<typeof resolveHandover>[1]));
