import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { recordFoodCheck } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => recordFoodCheck(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key"), capturedAt: getHeader(req, "x-offline-captured-at") } as Parameters<typeof recordFoodCheck>[1]));
