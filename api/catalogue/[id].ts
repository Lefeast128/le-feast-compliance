import { getRouteParam, handleWrite, type ApiRequest, type ApiResponse } from "../../src/server/compliance/http.js";
import { updateCatalogueWastageConfig } from "../../src/server/catalogue/service.js";

export default (req: ApiRequest, res: ApiResponse) => handleWrite(req, res, ["PATCH"], (context, body) => updateCatalogueWastageConfig(context, getRouteParam(req, "id") ?? "", body));
