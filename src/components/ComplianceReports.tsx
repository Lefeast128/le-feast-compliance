/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileWarning,
  LayoutDashboard,
  Printer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restApi } from "@/lib/rest-domain";
import IssueJourneyDialog from "@/components/IssueJourneyDialog";
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

type ReportTab = "overview" | "daily" | "issues" | "reviews" | "pack";
type StatusTone = "green" | "amber" | "red" | "grey";
type IssueFilter = "all" | "open" | "monitoring" | "resolved";

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

const toneClasses: Record<StatusTone, string> = {
  green: "border-[#bfe3c9] bg-[#effaf1] text-[#216c45]",
  amber: "border-[#ead9a6] bg-[#fff9e8] text-[#8a6513]",
  red: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]",
  grey: "border-black/[0.08] bg-[#f4f5f3] text-[#727a74]",
};

const toneIcon: Record<StatusTone, typeof CheckCircle2> = {
  green: CheckCircle2,
  amber: AlertTriangle,
  red: XCircle,
  grey: FileWarning,
};

function StatusPill({ tone, children }: { tone: StatusTone; children: string }) {
  const Icon = toneIcon[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function ReportNavCard({
  active,
  title,
  description,
  detail,
  icon: Icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  detail: string;
  icon: typeof LayoutDashboard;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`group flex min-h-32 w-full items-start justify-between gap-4 rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ad2a] ${active ? "border-[#d7ad2a] bg-[#fffdf4] shadow-sm" : "border-black/[0.07] bg-white"}`}
    >
      <span className="min-w-0">
        <span className={`mb-4 flex size-10 items-center justify-center rounded-xl ${active ? "bg-[#fff1b8] text-[#80610e]" : "bg-[#f2f5ef] text-[#41604e]"}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm leading-5 text-[#727a74]">{description}</span>
        <span className="mt-3 block text-xs font-semibold text-[#89918b]">{detail}</span>
      </span>
      <ChevronRight className="mt-2 size-5 shrink-0 text-[#89918b] transition group-hover:translate-x-1" aria-hidden="true" />
    </button>
  );
}

const reportDate = (date: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));

const shortDate = (date: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T12:00:00Z`));

const localTime = (value: string | null | undefined, timeZone: string) => {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const dayTone = (day: any): StatusTone =>
  day.status === "green" ? "green" : day.status === "amber" ? "amber" : day.status === "grey" ? "grey" : "red";

const dayStatus = (day: any) => {
  if (day.status === "green") return { label: "Complete", detail: day.afterUseCleaningStatus === "recorded" ? "Required work complete · cleaning recorded" : day.cleaningStatus === "not_verifiable" ? "Required work complete · after-use cleaning not verifiable" : day.cleaningStatus === "not_required" ? "Required work complete · no scheduled cleaning" : "No issues recorded" };
  if (day.status === "amber") return { label: "Complete", detail: "Issue or corrective action recorded" };
  if (day.status === "grey") return { label: "Future", detail: "Not evaluated yet" };
  const outstanding = Object.values(day.sections ?? {}).filter((value) => value === false).length;
  return { label: "Incomplete", detail: outstanding ? `${outstanding} checks outstanding` : "Required evidence is incomplete" };
};

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
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [issueFilter, setIssueFilter] = useState<IssueFilter>("all");
  const [inspectionPack, setInspectionPack] = useState<any>(null);
  const [inspectionPackLoading, setInspectionPackLoading] = useState(false);
  const activeLocation = locations.find(
    (location) => locationIdOf(location) === activeLocationId,
  );
  const timeZone = report?.range?.timezone ?? "Europe/London";

  useEffect(() => {
    setActiveLocationId(locationId);
  }, [locationId]);

  useEffect(() => {
    if (!activeLocationId || !range.start || !range.end) return;
    let cancelled = false;
    setReport(null);
    setInspectionPack(null);
    setSelectedIssue(null);
    setActiveTab("overview");
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

  const sections = useMemo(
    () => Object.entries(report?.sections ?? {}),
    [report],
  );
  const issues = useMemo(() => report?.issues?.rows ?? [], [report]);
  const filteredIssues = useMemo(
    () => issueFilter === "all" ? issues : issues.filter((issue: any) => issue.status === issueFilter),
    [issueFilter, issues],
  );
  const percentage =
    report?.summary?.completionRate == null
      ? "—"
      : `${Math.round(report.summary.completionRate * 100)}%`;
  const overallTone: StatusTone = report?.summary?.incompleteDays
    ? "red"
    : report?.summary?.correctiveActionDays
      ? "amber"
      : "green";

  const applyPreset = (next: ReportRange) => setRange(next);
  const setCustom = (key: "start" | "end", value: string) =>
    setRange((current) => ({ ...current, [key]: value }));

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

  const generateInspectionPack = async () => {
    if (!activeLocationId || !range.start || !range.end) return;
    setInspectionPackLoading(true);
    try {
      const value = await restApi.reports.inspectionPack({
        locationId: activeLocationId,
        start: range.start,
        end: range.end,
      });
      setInspectionPack(value);
      setActiveTab("pack");
      toast.success("Inspection pack ready");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to generate inspection pack");
    } finally {
      setInspectionPackLoading(false);
    }
  };

  const renderOverview = () => (
    <div className="space-y-5">
      <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Compliance overview</p>
            <h2 className="mt-2 text-3xl font-semibold sm:text-4xl">Compliance {percentage}</h2>
            <p className="mt-2 text-sm text-[#727a74]">
              {report.summary.completeDays} of {report.summary.daysEvaluated} evaluated days complete
            </p>
          </div>
          <StatusPill tone={overallTone}>
            {overallTone === "green" ? "All evaluated days complete" : overallTone === "amber" ? "Corrective action recorded" : "Attention required"}
          </StatusPill>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Evaluated days", report.summary.daysEvaluated],
            ["Complete days", report.summary.completeDays],
            ["Incomplete days", report.summary.incompleteDays],
            ["Days with issues", report.summary.correctiveActionDays],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-[#fafbf9] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#89918b]">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Evidence coverage</p>
          <h2 className="mt-1 text-xl font-semibold">Section completion</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {sections.map(([key, value]: any) => {
            const complete = value.requiredDays > 0 && value.completedDays === value.requiredDays;
            const tone: StatusTone = complete ? "green" : value.completedDays > 0 ? "amber" : "red";
            return (
              <div key={key} className="rounded-2xl border border-black/[0.06] bg-[#fafbf9] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${tone === "green" ? "bg-[#dff3e5] text-[#216c45]" : tone === "amber" ? "bg-[#fff1c7] text-[#8a6513]" : "bg-[#ffe3df] text-[#a13d32]"}`}>
                      {tone === "green" ? <CheckCircle2 className="size-4" /> : tone === "amber" ? <AlertTriangle className="size-4" /> : <XCircle className="size-4" />}
                    </span>
                    <span className="truncate font-semibold">{sectionLabels[key] ?? key}</span>
                  </div>
                  <span className="text-sm font-semibold text-[#727a74]">
                    {value.requiredDays ? `${Math.round((value.completedDays / value.requiredDays) * 100)}%` : "—"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-[#727a74]">{value.completedDays} / {value.requiredDays} complete</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderDailyRecords = () => (
    <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Evidence by date</p>
        <h2 className="mt-1 text-xl font-semibold">Daily records</h2>
        <p className="mt-1 text-sm text-[#727a74]">Choose a day to review the recorded checks and evidence.</p>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {report.days.map((day: any) => {
          const tone = dayTone(day);
          const status = dayStatus(day);
          return (
            <button
              type="button"
              key={day.date}
              onClick={() => onOpenDay?.(day.date, activeLocationId)}
              className="group flex min-h-32 w-full items-center justify-between gap-4 rounded-2xl border border-black/[0.07] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ad2a]"
            >
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{reportDate(day.date, timeZone)}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusPill tone={tone}>{status.label}</StatusPill>
                  {day.correctiveActionRecorded && <span className="text-xs font-semibold text-[#8a6513]">Corrective action recorded</span>}
                  {day.afterUseCleaningStatus === "recorded" && <span className="text-xs font-semibold text-[#216c45]">Cleaning recorded</span>}
                  {day.cleaningStatus === "not_verifiable" && <span className="text-xs font-semibold text-[#8a6513]">After-use cleaning not verifiable</span>}
                  {day.cleaningStatus === "not_required" && <span className="text-xs font-semibold text-[#89918b]">No scheduled cleaning</span>}
                </span>
                <span className="mt-2 block text-sm text-[#727a74]">{status.detail}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-[#89918b]">
                <span className="hidden text-right sm:block">{day.counts?.temperatureReadings ?? 0} temperature readings</span>
                <ChevronRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
      {!report.days.length && <p className="mt-5 text-sm text-[#727a74]">No daily records in this period.</p>}
    </section>
  );

  const renderIssues = () => (
    <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Failures and follow-up</p>
          <h2 className="mt-1 text-xl font-semibold">Issues &amp; Actions</h2>
          <p className="mt-1 text-sm text-[#727a74]">Each issue appears once. Open the journey for the full evidence trail.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Issue status filter">
          {(["all", "open", "monitoring", "resolved"] as IssueFilter[]).map((filter) => (
            <button
              type="button"
              key={filter}
              onClick={() => setIssueFilter(filter)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold capitalize transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ad2a] ${issueFilter === filter ? "border-[#d7ad2a] bg-[#fff6cd] text-[#80610e]" : "border-black/[0.08] bg-white text-[#727a74]"}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {filteredIssues.map((issue: any) => {
          const tone: StatusTone = issue.status === "resolved" ? "green" : issue.status === "monitoring" ? "amber" : "red";
          return (
            <article key={issue.id} className="rounded-2xl border border-black/[0.07] bg-[#fafbf9] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#89918b]">{issue.category}</p>
                  <h3 className="mt-1 text-lg font-semibold">{issue.title}</h3>
                </div>
                <StatusPill tone={tone}>{issue.status === "resolved" ? "Resolved" : issue.status === "monitoring" ? "Monitoring" : "Open"}</StatusPill>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#89918b]">Original result</p>
                  <p className="mt-1 text-sm font-semibold">{issue.originalLabel ?? issue.description}</p>
                  {issue.originalReading && <p className="mt-1 text-sm text-[#a13d32]">{issue.originalReading} · Failed</p>}
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#89918b]">Immediate corrective action</p>
                  <p className="mt-1 text-sm font-semibold">{issue.latestAction?.note ?? "Not recorded"}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#89918b]">
                  Reported by {issue.teamMemberName ?? "Not recorded"} · {localTime(issue.createdAt, timeZone)} · {issue.recheckCount ?? 0} recheck{issue.recheckCount === 1 ? "" : "s"}
                </p>
                <Button variant="outline" size="sm" onClick={() => setSelectedIssue(issue)}>
                  View issue journey <ChevronRight className="ml-1 size-4" />
                </Button>
              </div>
            </article>
          );
        })}
        {!filteredIssues.length && <p className="py-4 text-sm text-[#727a74]">No issues match this filter.</p>}
      </div>
    </section>
  );

  const renderManagerReviews = () => {
    const rows = report.managerReviews?.rows ?? [];
    const weekly = rows.filter((review: any) => review.reviewType !== "four_weekly");
    const fourWeekly = rows.filter((review: any) => review.reviewType === "four_weekly");
    const reviewCard = (review: any) => (
      <details key={review.id} className="group rounded-2xl border border-black/[0.07] bg-[#fafbf9] p-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7ad2a]">
          <span>
            <span className="block text-xs font-bold uppercase tracking-[0.16em] text-[#89918b]">{review.reviewType === "four_weekly" ? "4-weekly review" : "Weekly review"}</span>
            <span className="mt-1 block text-lg font-semibold">{shortDate(review.periodStart, timeZone)} – {shortDate(review.periodEnd, timeZone)}</span>
            <span className="mt-1 block text-sm text-[#727a74]">Issues raised: {review.summary?.issuesRaised ?? 0} · Resolved: {review.summary?.issuesResolved ?? 0} · Outstanding: {review.summary?.outstandingIssues ?? 0}</span>
          </span>
          <span className="flex items-center gap-2"><StatusPill tone="green">Completed</StatusPill><ChevronRight className="size-5 text-[#89918b] transition group-open:rotate-90" /></span>
        </summary>
        <div className="mt-4 border-t border-black/[0.07] pt-4 text-sm text-[#727a74]">
          <p>Completed by {review.completedBy ?? "Not recorded"} · {localTime(review.completedAt, timeZone)}</p>
          {review.details && <p className="mt-2"><span className="font-semibold text-[#171918]">Details:</span> {review.details}</p>}
          {review.actionTaken && <p className="mt-2"><span className="font-semibold text-[#171918]">Action taken:</span> {review.actionTaken}</p>}
        </div>
      </details>
    );
    return (
      <div className="space-y-5">
        {[
          ["Weekly reviews", weekly],
          ["4-weekly reviews", fourWeekly],
        ].map(([title, items]: any) => (
          <section key={title} className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Management oversight</p>
            <h2 className="mt-1 text-xl font-semibold">{title}</h2>
            <div className="mt-5 space-y-3">
              {items.map(reviewCard)}
              {!items.length && <p className="text-sm text-[#727a74]">No completed reviews recorded in this period.</p>}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const renderInspectionPack = () => {
    const packReport = inspectionPack?.report ?? report;
    const chronology = inspectionPack?.chronology ?? [];
    const missingEvidence = (packReport?.days ?? []).flatMap((day: any) => {
      const missing = Object.entries(day.sections ?? {})
        .filter(([, value]) => value === false)
        .map(([key]) => `${reportDate(day.date, timeZone)} · ${sectionLabels[key] ?? key} incomplete`);
      if (day.cleaningStatus === "incomplete") missing.push(`${reportDate(day.date, timeZone)} · Cleaning required but missed`);
      if (day.cleaningStatus === "not_verifiable" || day.afterUseCleaningStatus === "not_verifiable") missing.push(`${reportDate(day.date, timeZone)} · Usage requirement: Not verifiable`);
      return missing;
    });
    const cleaningLabel = (day: any) => [
      day.cleaningStatus === "complete" ? "Cleaning required and completed" : "",
      day.cleaningStatus === "incomplete" ? "Cleaning required but missed" : "",
      day.afterUseCleaningStatus === "recorded" ? "Cleaning recorded" : "",
      day.afterUseCleaningStatus === "not_verifiable" || day.cleaningStatus === "not_verifiable" ? "Usage requirement: Not verifiable" : "",
    ].filter(Boolean).join(" · ") || "No cleaning scheduled";
    return (
      <article id="inspection-pack" className="space-y-5 print:bg-white">
        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6513]">Le Feast Compliance</p>
              <h2 className="mt-2 text-3xl font-semibold">Inspection Evidence Pack</h2>
              <p className="mt-2 text-sm text-[#727a74]">{activeLocation?.name ?? packReport?.location?.name} · {reportRangeLabel(range)}</p>
              <p className="mt-1 text-xs text-[#89918b]">Generated {localTime(inspectionPack?.generatedAt, timeZone)} · Store timezone: {timeZone}</p>
            </div>
            <div className="flex flex-wrap gap-2 print:hidden">
              <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 size-4" />Print / Save PDF</Button>
              <Button variant="outline" onClick={() => setActiveTab("overview")}>Back to report</Button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Inspection overview</p><h2 className="mt-1 text-xl font-semibold">Completion and evidence coverage</h2></div>
            <StatusPill tone={overallTone}>{overallTone === "green" ? "Complete" : overallTone === "amber" ? "Corrective action recorded" : "Attention required"}</StatusPill>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Opening / Closing checks", (packReport?.sections?.opening_checklist?.completedDays ?? 0) + (packReport?.sections?.closing_checklist?.completedDays ?? 0), (packReport?.sections?.opening_checklist?.requiredDays ?? 0) + (packReport?.sections?.closing_checklist?.requiredDays ?? 0)],
              ["AM / PM temperatures", (packReport?.sections?.temperature_am?.completedDays ?? 0) + (packReport?.sections?.temperature_pm?.completedDays ?? 0), (packReport?.sections?.temperature_am?.requiredDays ?? 0) + (packReport?.sections?.temperature_pm?.requiredDays ?? 0)],
              ["Food probes", packReport?.sections?.food_probes?.completedDays ?? 0, packReport?.sections?.food_probes?.requiredDays ?? 0],
              ["Security checks", (packReport?.sections?.security_am?.completedDays ?? 0) + (packReport?.sections?.security_pm?.completedDays ?? 0), (packReport?.sections?.security_am?.requiredDays ?? 0) + (packReport?.sections?.security_pm?.requiredDays ?? 0)],
              ["Cleaning", packReport?.sections?.cleaning?.completedDays ?? 0, packReport?.sections?.cleaning?.requiredDays ?? 0],
              ["Additional checks", packReport?.sections?.additional_checks?.completedDays ?? 0, packReport?.sections?.additional_checks?.requiredDays ?? 0],
              ["Wastage records", packReport?.wastage?.daysWithRecord ?? 0, packReport?.summary?.daysEvaluated ?? 0],
              ["Manager reviews", packReport?.managerReviews?.rows?.length ?? 0, ""],
            ].map(([label, complete, required]) => <div key={String(label)} className="rounded-2xl bg-[#fafbf9] p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[#89918b]">{label}</p><p className="mt-2 text-xl font-semibold">{complete}{required !== "" ? ` / ${required}` : ""}</p></div>)}
          </div>
        </section>

        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Exceptions and cleaning evidence</p>
          <h2 className="mt-1 text-xl font-semibold">What needs context</h2>
          <div className="mt-4 space-y-2">
            {(packReport?.days ?? []).map((day: any) => <div key={day.date} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafbf9] p-3 text-sm"><span>{reportDate(day.date, timeZone)}</span><span className="font-semibold text-[#727a74]">{day.cleaningStatus === "not_required" && !day.afterUseCleaningStatus ? "No cleaning scheduled" : cleaningLabel(day)}{day.correctiveActionRecorded ? " · Corrective action recorded" : ""}</span></div>)}
            {missingEvidence.map((item: string) => <p key={item} className="rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#a13d32]">Missing or unverifiable evidence: {item}</p>)}
            {!missingEvidence.length && <p className="text-sm text-[#216c45]">No missing or unverifiable required evidence in this range.</p>}
          </div>
        </section>

        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Issues and corrective actions</p><h2 className="mt-1 text-xl font-semibold">Outstanding and resolved issues</h2></div><span className="text-sm text-[#727a74]">{packReport?.issues?.rows?.length ?? 0} issues in evidence</span></div>
          <div className="mt-4 space-y-3">{(packReport?.issues?.rows ?? []).map((issue: any) => <div key={issue.id} className="rounded-2xl border border-black/[0.06] bg-[#fafbf9] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">{issue.originalLabel ?? issue.category}{issue.originalReading ? ` · ${issue.originalReading} · Failed` : ""}</p><p className="mt-1 text-sm text-[#727a74]">Corrective action: {issue.latestAction?.note ?? "Not recorded"}</p></div><StatusPill tone={issue.status === "resolved" ? "green" : issue.status === "monitoring" ? "amber" : "red"}>{issue.status === "resolved" ? "Resolved" : issue.status === "monitoring" ? "Monitoring" : "Open"}</StatusPill></div><p className="mt-2 text-xs text-[#89918b]">Reported by {issue.teamMemberName ?? "Not recorded"} · {localTime(issue.createdAt, timeZone)} · {issue.recheckCount ?? 0} rechecks</p></div>)}{!(packReport?.issues?.rows ?? []).length && <p className="text-sm text-[#727a74]">No issues recorded in this range.</p>}</div>
        </section>

        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Evidence chronology</p>
          <h2 className="mt-1 text-xl font-semibold">What happened, when and who recorded it</h2>
          <div className="mt-5 space-y-3">{chronology.map((event: any) => <article key={event.id} className="rounded-2xl border border-black/[0.06] bg-[#fafbf9] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{event.title}</p><p className="mt-1 text-sm text-[#727a74]">{event.detail}</p></div>{event.result && <span className="text-sm font-semibold">{event.result}</span>}</div><p className="mt-2 text-xs text-[#89918b]">{localTime(event.occurredAt, timeZone)} · Recorded by {event.teamMemberName ?? "Not recorded"}</p></article>)}{!chronology.length && <p className="text-sm text-[#727a74]">No inspection activity recorded in this range.</p>}</div>
        </section>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[15px] font-semibold">Compliance reports</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Evidence, status and follow-up</p>
          </div>
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="mr-2 size-4" /> Back to setup
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="text-sm font-semibold">
              Store
              <select value={activeLocationId} onChange={(event) => setActiveLocationId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">
                {locations.map((location) => <option key={locationIdOf(location)} value={locationIdOf(location)}>{location.name}</option>)}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => applyPreset(currentMonthRange())}>Current month</Button>
              <Button variant="outline" onClick={() => applyPreset(previousMonthRange())}>Previous month</Button>
              <Button variant="outline" onClick={() => applyPreset(last30DaysRange())}>Last 30 days</Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Start date<Input type="date" value={range.start} onChange={(event) => setCustom("start", event.target.value)} className="mt-2 h-11" /></label>
            <label className="text-sm font-semibold">End date<Input type="date" value={range.end} onChange={(event) => setCustom("end", event.target.value)} className="mt-2 h-11" /></label>
          </div>
        </section>

        {loading && <section className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">Loading report…</section>}
        {error && <section className="rounded-2xl border border-[#efc8c3] bg-white p-6 text-sm text-[#a13d32]">{error}</section>}

        {report && (
          <>
            <section className="rounded-3xl border border-black/[0.07] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{activeLocation?.name ?? report.location.name}</p>
                  <h1 className="mt-1 text-2xl font-semibold">{reportRangeLabel(range)}</h1>
                  <p className="mt-1 text-sm text-[#727a74]">Store timezone: {report.range.timezone}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={Boolean(exporting)} onClick={() => downloadExport("csv")}><Download className="mr-2 size-4" />{exporting === "csv" ? "Preparing…" : "Download CSV"}</Button>
                  <Button variant="outline" disabled={Boolean(exporting)} onClick={() => downloadExport("xlsx")}><Download className="mr-2 size-4" />{exporting === "xlsx" ? "Preparing…" : "Download Excel"}</Button>
                  <Button className="bg-[#ffde59] text-[#171918] hover:bg-[#f3cf3e]" disabled={inspectionPackLoading} onClick={generateInspectionPack}><ClipboardCheck className="mr-2 size-4" />{inspectionPackLoading ? "Generating…" : "Generate Inspection Pack"}</Button>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Compliance report sections">
              <ReportNavCard active={activeTab === "overview"} title="Overview" description="Compliance status at a glance" detail={`${percentage} complete`} icon={LayoutDashboard} onClick={() => setActiveTab("overview")} />
              <ReportNavCard active={activeTab === "daily"} title="Daily records" description="Daily checks and recorded evidence" detail={`${report.days.length} days in range`} icon={CalendarDays} onClick={() => setActiveTab("daily")} />
              <ReportNavCard active={activeTab === "issues"} title="Issues & Actions" description="Failures and corrective actions" detail={`${issues.length} issue${issues.length === 1 ? "" : "s"} in evidence`} icon={FileWarning} onClick={() => setActiveTab("issues")} />
              <ReportNavCard active={activeTab === "reviews"} title="Manager reviews" description="Weekly and 4-weekly oversight" detail={`${report.managerReviews?.rows?.length ?? 0} completed`} icon={ClipboardCheck} onClick={() => setActiveTab("reviews")} />
              {inspectionPack && <ReportNavCard active={activeTab === "pack"} title="Inspection pack" description="Printable read-only evidence" detail="Ready to print or save as PDF" icon={Printer} onClick={() => setActiveTab("pack")} />}
            </div>

            {activeTab === "overview" && renderOverview()}
            {activeTab === "daily" && renderDailyRecords()}
            {activeTab === "issues" && renderIssues()}
            {activeTab === "reviews" && renderManagerReviews()}
            {activeTab === "pack" && renderInspectionPack()}
          </>
        )}
      </main>
      {selectedIssue && <IssueJourneyDialog issue={selectedIssue} timeZone={timeZone} onClose={() => setSelectedIssue(null)} />}
    </div>
  );
}
