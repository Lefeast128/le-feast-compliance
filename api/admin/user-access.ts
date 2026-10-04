import { handleQuery, parseBody, requireContext, requireMutationRequest, respondError, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { inviteUser, listUserAccess, UserAccessDeliveryError } from "../../src/server/management/user-access-service.js";

function respondUserAccessError(res: ApiResponse, error: unknown) {
  if (error instanceof UserAccessDeliveryError) {
    res.status(502).json({ ok: false, error: error.message, accessCreated: error.accessCreated });
    return;
  }
  respondError(res, error);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method === "GET") return handleQuery(req, res, listUserAccess);
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    requireMutationRequest(req);
    const context = await requireContext(req);
    res.status(200).json({ ok: true, data: await inviteUser(context, parseBody(req)) });
  } catch (error) {
    respondUserAccessError(res, error);
  }
}
