import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { saveChecklistResponse } from "../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => saveChecklistResponse(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key") } as Parameters<typeof saveChecklistResponse>[1]));
