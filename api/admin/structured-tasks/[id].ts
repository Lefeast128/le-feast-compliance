import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { updateLocalStructuredTask } from "../../../src/server/compliance/structured-task-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH", "POST"], (context, body) => updateLocalStructuredTask(context, {
  ...body,
  taskId: getRouteParam(req, "id") ?? body.taskId,
}));
