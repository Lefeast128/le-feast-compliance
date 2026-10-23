import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addWastageCategory, listWastageManagement } from "../../src/server/management/service.js";

export default (req: ApiRequest, res: ApiResponse) => req.method === "GET"
  ? handleQuery(req, res, context => listWastageManagement(context, String(req.query?.locationId ?? "")))
  : handleMutation(req, res, (context, body) => addWastageCategory(context, body));
