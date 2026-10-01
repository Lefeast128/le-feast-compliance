import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addMembership } from "../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addMembership(context, body));
