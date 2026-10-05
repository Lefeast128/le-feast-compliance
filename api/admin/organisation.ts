import { handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { listOrganisationControls } from "../../src/server/management/organisation-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, listOrganisationControls);
