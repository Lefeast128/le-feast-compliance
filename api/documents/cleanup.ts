import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { cleanupUpload } from "../../src/server/documents/service.js";

export default (req: ApiRequest, res: ApiResponse) =>
  handleMutation(req, res, (context, body) => cleanupUpload(context, body));
