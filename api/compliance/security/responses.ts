import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { saveSecurityResponse } from "../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => saveSecurityResponse(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key") } as Parameters<typeof saveSecurityResponse>[1]));
