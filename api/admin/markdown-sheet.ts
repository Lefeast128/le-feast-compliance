import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { listMarkdownConfig, updateMarkdownConfig } from "../../src/server/compliance/markdown-service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, context => listMarkdownConfig(context, String(req.query?.locationId ?? "")));
  return handleMutation(req, res, (context, body) => updateMarkdownConfig(context, body));
};
