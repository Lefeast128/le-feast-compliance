import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { publishCentralChecklist } from "../../../src/server/management/organisation-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, publishCentralChecklist);
