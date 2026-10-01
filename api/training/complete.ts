import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { completeTraining } from "../../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, completeTraining);
