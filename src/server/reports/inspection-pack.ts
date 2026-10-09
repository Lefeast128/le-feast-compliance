import { archive } from "../history/service.js";
import type { AuthContext } from "../auth/core.js";
import { complianceReport } from "./service.js";
import { reportDateRange } from "./calculations.js";

/**
 * Inspection packs are a read-only composition of the existing report and
 * historical archive services. Keeping the evidence sources unchanged means
 * the pack cannot create a second interpretation of operational records.
 */
export async function inspectionPack(context: AuthContext, input: { locationId: string; start: unknown; end: unknown }) {
  const report = await complianceReport(context, input);
  const range = reportDateRange(input.start, input.end);
  const archives = await Promise.all(
    range.days.map(date => archive(context, { locationId: input.locationId, start: date, end: date })),
  );
  const chronology = archives
    .flatMap(day => day.chronology ?? [])
    .sort((a, b) => String(a.occurredAt).localeCompare(String(b.occurredAt)) || String(a.id).localeCompare(String(b.id)));

  return {
    generatedAt: new Date().toISOString(),
    report,
    chronology,
    archives,
  };
}
