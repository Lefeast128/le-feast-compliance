import { handleMutation, handleQuery, type ApiRequest, type ApiResponse } from "../src/server/compliance/http.js";
import { addMarkdownProduct, listMarkdownSheet, updateMarkdownSheet } from "../src/server/compliance/markdown-service.js";

export default (req: ApiRequest, res: ApiResponse) => {
  if (req.method === "GET") return handleQuery(req, res, context => listMarkdownSheet(context, String(req.query?.locationId ?? ""), String(req.query?.dateKey ?? "")));
  if (req.method === "POST") return handleMutation(req, res, async (context, body) => body.action === "add-product" ? addMarkdownProduct(context, { locationId: String(body.locationId ?? ""), name: String(body.name ?? "") }) : updateMarkdownSheet(context, body));
  res.status(405).json({ ok: false, error: "Method not allowed" });
};
