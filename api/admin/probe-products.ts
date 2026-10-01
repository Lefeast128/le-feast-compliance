import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addProbe } from "../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addProbe(context, body));
