import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { recordFoodCheck } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => recordFoodCheck(context, body as Parameters<typeof recordFoodCheck>[1]));
