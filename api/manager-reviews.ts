import { getRouteParam, handleQuery, handleMutation, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { completeManagerReview, getManagerReviews } from "../src/server/reviews/service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, context => getManagerReviews(context, getRouteParam(req, "locationId") ?? ""));
  return handleMutation(req, res, (context, body) => completeManagerReview(context, body));
};
