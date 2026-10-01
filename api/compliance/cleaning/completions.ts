import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { completeCleaning } from "../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => completeCleaning(context, body as Parameters<typeof completeCleaning>[1]));
