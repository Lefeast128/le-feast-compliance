import { getHeader, handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { createHandover, listHandover } from "../src/server/management/shift-handover-service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, context => listHandover(context, String(req.query?.locationId ?? "")));
  return handleMutation(req, res, (context, body) => createHandover(context, { ...body, idempotencyKey: getHeader(req, "idempotency-key") } as Parameters<typeof createHandover>[1]));
};
