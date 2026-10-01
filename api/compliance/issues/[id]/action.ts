import { handleMutation, getRouteParam, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { addIssueAction } from "../../../../src/server/compliance/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => addIssueAction(context, { ...body, issueId: getRouteParam(req, "id") } as Parameters<typeof addIssueAction>[1]));
