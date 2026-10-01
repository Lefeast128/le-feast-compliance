import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addTraining, listTraining } from "../../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => req.method === "GET" ? handleQuery(req, res, context => listTraining(context, String(req.query?.locationId ?? ""))) : handleMutation(req, res, (context, body) => addTraining(context, body));
