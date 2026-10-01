import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { addTeamMember, listTeamMembers } from "../src/server/management/service.js";
export default async (req: ApiRequest, res: ApiResponse) => { if (req.method === "GET") return handleQuery(req, res, async context => listTeamMembers(context, String(req.query?.locationId ?? ""))); return handleMutation(req, res, (context, body) => addTeamMember(context, body)); };
