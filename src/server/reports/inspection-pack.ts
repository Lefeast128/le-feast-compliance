import { archive } from "../history/service.js";
import type { AuthContext } from "../auth/core.js";
import { complianceReport } from "./service.js";
import { reportDateRange } from "./calculations.js";

export type InspectionPackLoaders = {
  loadReport: typeof complianceReport;
  loadArchive: typeof archive;
};

/**
 * Inspection packs are a read-only composition of the existing report and
 * historical archive services. Keeping the evidence sources unchanged means
 * the pack cannot create a second interpretation of operational records.
 */
export async function buildInspectionPack(
  context: AuthContext,
  input: { locationId: string; start: unknown; end: unknown },
  loaders: InspectionPackLoaders = { loadReport: complianceReport, loadArchive: archive },
) {
  const range = reportDateRange(input.start, input.end);
  // Keep the two range reads bounded: each service performs its own batched
  // database reads, while history is fetched once for the whole pack.
  const [report, history] = await Promise.all([
    loaders.loadReport(context, input),
    loaders.loadArchive(context, { locationId: input.locationId, start: range.start, end: range.end }),
  ]);
  const chronology = [...(history.chronology ?? [])].sort(
    (a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)) || String(a.id).localeCompare(String(b.id)),
  );

  return {
    generatedAt: new Date().toISOString(),
    report,
    history,
    chronology,
  };
}

export async function inspectionPack(context: AuthContext, input: { locationId: string; start: unknown; end: unknown }) {
  return buildInspectionPack(context, input);
}
