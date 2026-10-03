/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restApi } from "@/lib/rest-domain";
import { toast } from "sonner";
import {
  currentMonthRange,
  last30DaysRange,
  previousMonthRange,
  reportRangeLabel,
  type ReportRange,
} from "@/lib/compliance-reports";

type Location = {
  id?: string;
  _id?: string;
  name: string;
  shortName?: string | null;
};
type Props = {
  locationId: string;
  locations: Location[];
  onBack: () => void;
  onOpenDay?: (date: string, locationId: string) => void;
};
const locationIdOf = (location: Location) => location._id ?? location.id ?? "";
const sectionLabels: Record<string, string> = {
  temperature_am: "AM temperatures",
  opening_checklist: "Opening checklist",
  security_am: "AM security",
  food_probes: "Food probes",
  cleaning: "Cleaning",
  wastage: "Wastage",
  additional_checks: "Additional checks",
  temperature_pm: "PM temperatures",
  security_pm: "PM security",
  closing_checklist: "Closing checklist",
};
const safeError = (error: unknown) =>
  error instanceof Error && error.message
    ? error.message
    : "Unable to load compliance report";

export default function ComplianceReports({
  locationId,
  locations,
  onBack,
  onOpenDay,
}: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locationId);
  const [range, setRange] = useState<ReportRange>(() => currentMonthRange());
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const activeLocation = locations.find(
    (location) => locationIdOf(location) === activeLocationId,
  );
  const sections = useMemo(
    () => Object.entries(report?.sections ?? {}),
    [report],
  );

  useEffect(() => {
    setActiveLocationId(locationId);
  }, [locationId]);

  useEffect(() => {
    if (!activeLocationId || !range.start || !range.end) return;
    let cancelled = false;
    setReport(null);
    setError(null);
    setLoading(true);
    restApi.reports
      .compliance({
        locationId: activeLocationId,
        start: range.start,
        end: range.end,
      })
      .then((value) => {
        if (!cancelled) setReport(value);
      })
      .catch((reason) => {
        if (!cancelled) setError(safeError(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeLocationId, range.start, range.end]);

  const applyPreset = (next: ReportRange) => setRange(next);
  const setCustom = (key: "start" | "end", value: string) =>
    setRange((current) => ({ ...current, [key]: value }));
  const percentage =
    report?.summary?.completionRate == null
      ? "—"
      : `${Math.round(report.summary.completionRate * 100)}%`;

  const downloadExport = async (format: "csv" | "xlsx") => {
    if (!report || !activeLocationId || !range.start || !range.end) return;
    setExporting(format);
    try {
      const params = new URLSearchParams({
        locationId: activeLocationId,
        start: range.start,
        end: range.end,
        format,
      });
      const response = await fetch(`/api/reports/compliance/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        let message = "Unable to export compliance report";
        try {
          const body = JSON.parse(text);
          if (body?.error) message = body.error;
        } catch {
          // Keep the user-facing error generic when the server did not return JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        ?? `le-feast-compliance-report.${format}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to export compliance report");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Compliance reports</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">
              Completion, exceptions and corrective actions
            </p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" /> Back to setup
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-sm font-semibold">
              Store
              <select
                value={activeLocationId}
                onChange={(event) => setActiveLocationId(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
              >
                {locations.map((location) => (
                  <option
                    key={locationIdOf(location)}
                    value={locationIdOf(location)}
                  >
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => applyPreset(currentMonthRange())}
              >
                Current month
              </Button>
              <Button
                variant="outline"
                onClick={() => applyPreset(previousMonthRange())}
              >
                Previous month
              </Button>
              <Button
                variant="outline"
                onClick={() => applyPreset(last30DaysRange())}
              >
                Last 30 days
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Start date
              <Input
                type="date"
                value={range.start}
                onChange={(event) => setCustom("start", event.target.value)}
                className="mt-2 h-11"
              />
            </label>
            <label className="text-sm font-semibold">
              End date
              <Input
                type="date"
                value={range.end}
                onChange={(event) => setCustom("end", event.target.value)}
                className="mt-2 h-11"
              />
            </label>
          </div>
        </section>
        {loading && (
          <section className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">
            Loading report…
          </section>
        )}
        {error && (
          <section className="rounded-2xl border border-[#efc8c3] bg-white p-6 text-sm text-[#a13d32]">
            {error}
          </section>
        )}
        {report && (
          <>
            <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                    {activeLocation?.name ?? report.location.name}
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold">
                    {reportRangeLabel(range)}
                  </h1>
                </div>
                <p className="text-sm text-[#727a74]">
                  {report.range.timezone}
                </p>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <Button
                    variant="outline"
                    disabled={Boolean(exporting)}
                    onClick={() => downloadExport("csv")}
                  >
                    <Download className="mr-2 size-4" />
                    {exporting === "csv" ? "Preparing…" : "Download CSV"}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={Boolean(exporting)}
                    onClick={() => downloadExport("xlsx")}
                  >
                    <Download className="mr-2 size-4" />
                    {exporting === "xlsx" ? "Preparing…" : "Download Excel"}
                  </Button>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Evaluated days", report.summary.daysEvaluated],
                  ["Complete days", report.summary.completeDays],
                  ["Incomplete days", report.summary.incompleteDays],
                  [
                    "Corrective-action days",
                    report.summary.correctiveActionDays,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl bg-[#fafbf9] p-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#89918b]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-[#727a74]">
                Completion: {percentage}
                {report.summary.daysEvaluated
                  ? ` · ${report.summary.completeDays} of ${report.summary.daysEvaluated} evaluated days complete`
                  : " · no evaluated days"}
              </p>
            </section>
            <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
              <h2 className="text-lg font-semibold">Section completion</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {sections.map(([key, value]: any) => (
                  <div key={key} className="rounded-xl bg-[#fafbf9] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">
                        {sectionLabels[key] ?? key}
                      </span>
                      <span className="text-sm text-[#727a74]">
                        {value.requiredDays
                          ? `${Math.round((value.completedDays / value.requiredDays) * 100)}%`
                          : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#727a74]">
                      {value.completedDays} / {value.requiredDays} complete
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
              <h2 className="text-lg font-semibold">Daily breakdown</h2>
              <div className="mt-4 divide-y divide-black/[0.06]">
                {report.days.map((day: any) => (
                  <button
                    type="button"
                    key={day.date}
                    onClick={() => onOpenDay?.(day.date, activeLocationId)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 py-3 text-left"
                  >
                    <span>
                      <span className="font-semibold">{day.date}</span>
                      <span className="ml-3 text-sm text-[#727a74]">
                        {day.status === "green"
                          ? "Complete"
                          : day.status === "amber"
                            ? "Complete · corrective action"
                            : day.status === "grey"
                              ? "Future"
                              : "Incomplete"}
                      </span>
                    </span>
                    <span className="text-sm text-[#727a74]">
                      {day.correctiveActionRecorded
                        ? "Corrective action recorded"
                        : "Open inspection"}
                    </span>
                  </button>
                ))}
                {!report.days.length && (
                  <p className="py-3 text-sm text-[#727a74]">
                    No days in this range.
                  </p>
                )}
              </div>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
                <h2 className="text-lg font-semibold">Exceptions</h2>
                {report.exceptions.length ? (
                  <div className="mt-4 space-y-3">
                    {report.exceptions.map((exception: any, index: number) => (
                      <div
                        key={`${exception.type}-${exception.occurredAt}-${index}`}
                        className="rounded-xl bg-[#fafbf9] p-4"
                      >
                        <div className="flex justify-between gap-3">
                          <p className="font-semibold">{exception.label}</p>
                          <span className="text-sm text-[#b64738]">
                            {exception.result}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#727a74]">
                          {exception.date} ·{" "}
                          {exception.value ??
                            exception.detail ??
                            "Failure recorded"}
                        </p>
                        <p className="mt-1 text-xs text-[#89918b]">
                          Recorded by{" "}
                          {exception.teamMemberName ?? "Not recorded"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#727a74]">
                    No recorded failures in this period.
                  </p>
                )}
              </section>
              <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
                <h2 className="text-lg font-semibold">
                  Corrective actions / issues
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Created{" "}
                    <b className="float-right">{report.issues.issuesCreated}</b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Resolved{" "}
                    <b className="float-right">
                      {report.issues.issuesResolved}
                    </b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Rechecks{" "}
                    <b className="float-right">
                      {report.issues.rechecksRecorded}
                    </b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Open at end{" "}
                    <b className="float-right">
                      {report.issues.openAtRangeEnd}
                    </b>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {report.issues.rows.map((issue: any) => (
                    <div key={issue.id} className="rounded-xl bg-[#fafbf9] p-4">
                      <p className="font-semibold">{issue.title}</p>
                      <p className="mt-1 text-sm text-[#727a74]">
                        {issue.category} · {issue.status} · {issue.recheckCount}{" "}
                        recheck{issue.recheckCount === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-xs text-[#89918b]">
                        Recorded by {issue.teamMemberName ?? "Not recorded"}
                      </p>
                      {issue.latestUpdate && (
                        <p className="mt-2 text-sm text-[#727a74]">
                          Latest action: {issue.latestUpdate.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
                <h2 className="text-lg font-semibold">Wastage evidence</h2>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Records{" "}
                    <b className="float-right">{report.wastage.totalRecords}</b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    No Waste{" "}
                    <b className="float-right">
                      {report.wastage.noWasteRecords}
                    </b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Days recorded{" "}
                    <b className="float-right">
                      {report.wastage.daysWithRecord}
                    </b>
                  </div>
                  <div className="rounded-xl bg-[#fafbf9] p-3">
                    Days missing{" "}
                    <b className="float-right">
                      {report.wastage.evaluatedDaysMissingEvidence}
                    </b>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
                <h2 className="text-lg font-semibold">Additional checks</h2>
                <p className="mt-3 text-sm text-[#727a74]">
                  {report.additional.completed} of {report.additional.due} due
                  checks completed · {report.additional.incomplete} incomplete
                </p>
                <div className="mt-4 space-y-2">
                  {report.additional.rows.map((row: any, index: number) => (
                    <div
                      key={`${row.requirementTitle}-${row.completedAt}-${index}`}
                      className="rounded-xl bg-[#fafbf9] p-3 text-sm"
                    >
                      <p className="font-semibold">{row.requirementTitle}</p>
                      <p className="mt-1 text-xs text-[#89918b]">
                        Due {row.scheduledDueDate ?? "Not scheduled"} ·{" "}
                        {row.completedAt
                          ? `Completed ${new Date(row.completedAt).toLocaleString("en-GB")}`
                          : "Not completed"}{" "}
                        · {row.teamMemberName ?? "Not recorded"}
                        {row.certificatePresent ? " · Certificate" : ""}
                      </p>
                      {row.documentUrl && (
                        <a
                          href={row.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block font-semibold text-[#27814f]"
                        >
                          View certificate
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
