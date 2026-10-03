import { getRouteParam, requireContext, respondError, type ApiRequest, type ApiResponse } from "../../../src/server/compliance/http.js";
import { ApiError } from "../../../src/server/compliance/errors.js";
import { complianceReport } from "../../../src/server/reports/service.js";
import { filenameForReport, renderComplianceCsv, renderComplianceWorkbook, type ExportFormat } from "../../../src/server/reports/export.js";

type BinaryResponse = ApiResponse & {
  setHeader: (name: string, value: string) => void;
  end: (body: Buffer) => void;
};

export default async (req: ApiRequest, res: ApiResponse) => {
  if (req.method !== "GET") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }
  try {
    const context = await requireContext(req);
    const locationId = getRouteParam(req, "locationId");
    const start = getRouteParam(req, "start");
    const end = getRouteParam(req, "end");
    const format = getRouteParam(req, "format");
    if (!locationId) throw new ApiError(400, "locationId is required");
    if (format !== "csv" && format !== "xlsx") throw new ApiError(400, "format must be csv or xlsx");

    const report = await complianceReport(context, { locationId, start, end });
    const output = res as BinaryResponse;
    const filename = filenameForReport(report, format as ExportFormat);
    output.setHeader("Content-Type", format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    output.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    output.setHeader("Cache-Control", "private, no-store");
    output.status(200);
    output.end(format === "csv" ? renderComplianceCsv(report) : await renderComplianceWorkbook(report));
  } catch (error) {
    respondError(res, error);
  }
};
