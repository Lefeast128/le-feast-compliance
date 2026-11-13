import { createUserWithPassword } from "../../../src/server/management/user-access-service.js";
import { handleMutation, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleMutation(req, res, createUserWithPassword);
}
