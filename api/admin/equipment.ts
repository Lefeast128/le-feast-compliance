import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { addEquipment } from "../../src/server/management/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addEquipment(context, body));
