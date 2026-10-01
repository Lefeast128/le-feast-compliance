import { getRouteParam, handleMutation, type ApiRequest, type ApiResponse } from "../../../../src/server/compliance/http.js";
import { attachTrainingDocument, removeTrainingDocument } from "../../../../src/server/training/service.js";
export default (req: ApiRequest, res: ApiResponse) => handleMutation(req, res, (context, body) => body.remove === true ? removeTrainingDocument(context, getRouteParam(req, "id") ?? "") : attachTrainingDocument(context, getRouteParam(req, "id") ?? "", String(body.documentId ?? ""), body));
