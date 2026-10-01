import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { recordTemperature } from "../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => recordTemperature(context, body as Parameters<typeof recordTemperature>[1]));
