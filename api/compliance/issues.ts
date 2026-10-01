import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { createManualIssue } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => createManualIssue(context, body as Parameters<typeof createManualIssue>[1]));
