import { getRouteParam, handleWrite, requireContext, requireMutationRequest, respondError, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { removeUserAccess, updateUserAccess } from "../../../src/server/management/user-access-service.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "DELETE") {
    try {
      requireMutationRequest(req);
      const context = await requireContext(req);
      res.status(200).json({ ok: true, data: await removeUserAccess(context, getRouteParam(req, "id") ?? "") });
    } catch (error) {
      respondError(res, error);
    }
    return;
  }
  return handleWrite(
    req,
    res,
    ["PATCH"],
    (context, body) => updateUserAccess(context, getRouteParam(req, "id") ?? "", body),
  );
}
