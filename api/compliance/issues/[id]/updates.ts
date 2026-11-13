import { getHeader, handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { addIssueUpdate } from "../../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addIssueUpdate(context, { ...body, issueId: getRouteParam(req, "id"), idempotencyKey: getHeader(req, "idempotency-key"), capturedAt: getHeader(req, "x-offline-captured-at") } as Parameters<typeof addIssueUpdate>[1]));
