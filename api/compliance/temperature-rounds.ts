import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { startRound } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => startRound(context, body as Parameters<typeof startRound>[1]));
