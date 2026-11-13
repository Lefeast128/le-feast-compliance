import { handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { getAllStoreManagerOverview } from "../../src/server/reviews/all-stores-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, getAllStoreManagerOverview);
