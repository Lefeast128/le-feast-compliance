import { handleQuery, getRouteParam, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { listStructuredTasks } from "../src/server/compliance/structured-task-service.js";

export default (req: ApiRequest, res: ApiResponse) => handleQuery(req, res, context => listStructuredTasks(context, {
  locationId: getRouteParam(req, "locationId") ?? "",
  date: getRouteParam(req, "date"),
}));
