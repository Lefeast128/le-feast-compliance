import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { signOffStructuredChecklist } from "../../../src/server/compliance/structured-task-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, signOffStructuredChecklist);
