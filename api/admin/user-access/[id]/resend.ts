import { getRouteParam, parseBody, requireContext, requireMutationRequest, respondError, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { resendUserInvitation, UserAccessDeliveryError } from "../../../../src/server/management/user-access-service.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    requireMutationRequest(req);
    const context = await requireContext(req);
    parseBody(req);
    res.status(200).json({ ok: true, data: await resendUserInvitation(context, getRouteParam(req, "id") ?? "") });
  } catch (error) {
    if (error instanceof UserAccessDeliveryError) {
      res.status(502).json({ ok: false, error: error.message, accessCreated: false });
      return;
    }
    respondError(res, error);
  }
}
