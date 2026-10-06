import { handleMutation, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { createUploadGrant } from "../../src/server/documents/service.js";

export default (req: ApiRequest, res: ApiResponse) =>
  handleMutation(req, res, (context, body) => createUploadGrant(context, body));
