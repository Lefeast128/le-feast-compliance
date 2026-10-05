import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { publishCentralOperationalTask } from "../../../src/server/management/organisation-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, publishCentralOperationalTask);
