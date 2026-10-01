import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { saveSecurityResponse } from "../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => saveSecurityResponse(context, body as Parameters<typeof saveSecurityResponse>[1]));
