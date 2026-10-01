import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addAdditional, listAdditional } from "../../src/server/additional/service.js";
export default (req: ApiRequest, res: ApiResponse) => req.method === "GET" ? handleQuery(req, res, context => listAdditional(context, String(req.query?.locationId ?? ""))) : handleMutation(req, res, (context, body) => addAdditional(context, body));
