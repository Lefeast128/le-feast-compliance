import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { signOffSecurity } from "../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => signOffSecurity(context, body as Parameters<typeof signOffSecurity>[1]));
