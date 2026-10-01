import { handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { operations } from "../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, operations);
