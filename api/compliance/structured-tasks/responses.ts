import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { saveStructuredTaskResponse } from "../../../src/server/compliance/structured-task-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => saveStructuredTaskResponse(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key") }));
