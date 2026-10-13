import { getHeader, handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { createManualIssue } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => createManualIssue(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key"), capturedAt: getHeader(req, "x-offline-captured-at") } as Parameters<typeof createManualIssue>[1]));
