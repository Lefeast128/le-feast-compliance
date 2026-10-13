import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { completeAdditional } from "../../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => completeAdditional(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key") }));
