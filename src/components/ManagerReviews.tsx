import IssueDetail from "@/components/IssueDetail";
import ManagerOverviewPanel from "@/components/ManagerOverviewPanel";
import type { AdditionalDashboard, DashboardData } from "@/components/dashboard/dashboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildManagerActionCentre, type ManagerActionCentre } from "@/lib/manager-action-centre";
import type { ManagerOverviewSection, ManagerOverviewTarget } from "@/lib/manager-overview";
import { restApi, useRestMutation, useRestQueryState } from "@/lib/rest-domain";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Location = { _id?: string; id?: string; name: string; timezone?: string };
type Issue = {
  id: string;
  title: string;
  category: string;
  description: string;
  status: string;
  createdAt: string | null;
  createdByName?: string | null;
  teamMemberName?: string | null;
  latestAction?: string | null;
  latestRecheck?: { temperature: number; result: string; occurredAt: string | null } | null;
  recheckCount?: number;
  journey?: Array<{ eventType: string; occurredAt: string | null; title: string; detail: string; result?: string; teamMemberName?: string | null }>;
  originalReading?: string | null;
  action?: string | null;
};
type Period = { reviewType: string; start: string | null; end: string | null; status: "complete" | "due" | "overdue" | "up_to_date"; daysUntilDue: number; available: boolean; nextAvailableAfter: string | null; completed: boolean; summary: { issuesRaised: number; issuesResolved: number; outstandingIssues: number; openIssues?: number; monitoringIssues?: number; correctiveActions?: number; rechecks?: number; resolutionActivity?: number; failedTemperatureChecks: number; failedProbeChecks: number; otherIssues: number; repeatProblems: Array<{ label: string; count: number }> } };
type Review = { id: string; reviewType: string; periodStart: string; periodEnd: string; completedAt: string; completedBy: string; summary: Period["summary"]; seriousProblems: boolean | null; details: string | null; actionTaken: string | null; answers: Record<string, string> | null };
type ReviewResponse = { location: { id: string; name: string; timezone: string }; teamMembers: Array<{ _id: string; name: string }>; periods: { weekly: Period; four_weekly: Period }; currentIssues: Issue[]; resolvedIssues: Issue[]; reviewHistory: Review[] };
type ControlledDocumentSummary = { id: string; title: string; version: number; acknowledgement: { completionPercentage: number; deadline: string | null; overdue: boolean } };
type AllStoreSummary = {
  generatedAt: string;
  stores: Array<{
    location: { id: string; name: string; timezone: string };
    state: "ready" | "error";
    updatedAt: string | null;
    summary: { checksOutstanding: number; unresolvedIssues: number; cleaningOutstanding: number; reviewsDue: number; dueLater: number } | null;
  }>;
};
type Props = {
  locationId: string;
  locations: Location[];
  onBack: () => void;
  onOpenTask: (locationId: string, target: ManagerOverviewTarget) => void;
  onStoreChange: (locationId: string) => void;
  onRequestNavigation: (run: () => void) => void;
  activeSection: ManagerOverviewSection;
  onActiveSectionChange: (section: ManagerOverviewSection) => void;
  onDirtyChange: (dirty: boolean) => void;
  allStores: boolean;
  returnToAllStores: boolean;
  onAllStoresChange: (allStores: boolean) => void;
  onSelectAllStore: (locationId: string) => void;
  onReturnToAllStores: () => void;
};

const locationIdOf = (location: Location) => location._id ?? location.id ?? "";
const timeLabel = (value: string | null | undefined, timeZone: string) => value ? new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Time not recorded";
const reviewTypeLabel = (value: string) => value === "four_weekly" ? "4-Weekly Review" : "Weekly Review";
const periodStatusLabel = (period: Period) => period.status === "complete" ? "Complete" : period.status === "up_to_date" ? "Up to date" : period.status === "overdue" ? "Overdue" : period.daysUntilDue > 0 ? `Due in ${period.daysUntilDue} days` : "Due";
const issueStatusPresentation = (status: string) => status === "monitoring"
  ? { label: "Monitoring", className: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle }
  : { label: "Open", className: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]", icon: XCircle };

const FSA_QUESTIONS = [
  "Have you reviewed your safe methods?",
  "Has allergen information been updated to reflect any menu or ingredient changes?",
  "Have you changed any equipment or processes which change your safe methods?",
  "Have any new suppliers been recorded with contact information?",
  "Does the cleaning schedule require updating?",
  "Have new staff, if applicable, been trained in all safe methods?",
  "Do any existing staff require safe method refresher training?",
  "Are any extra opening or closing checks required?",
  "If any food complaints have been received, have they been investigated and safe methods reviewed?",
  "Have probes been calibrated in the last 4 weeks and results recorded?",
  "Have extra checks been completed and recorded weekly?",
  "Are prove-it checks being completed regularly and recorded?",
];

export default function ManagerReviews({ locationId, locations, onBack, onOpenTask, onStoreChange, onRequestNavigation, activeSection, onActiveSectionChange, onDirtyChange, allStores, returnToAllStores, onAllStoresChange, onSelectAllStore, onReturnToAllStores }: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locationId);
  const [revision, setRevision] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [weeklyNotes, setWeeklyNotes] = useState<Record<string, string>>({});
  const [weeklyStatuses, setWeeklyStatuses] = useState<Record<string, "open" | "monitoring" | "resolved">>({});
  const [seriousProblems, setSeriousProblems] = useState<"yes" | "no">("no");
  const [details, setDetails] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>(() => Object.fromEntries(FSA_QUESTIONS.map((_, index) => [String(index + 1), "yes"])) as Record<string, "yes" | "no">);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const dataQuery = useRestQueryState<ReviewResponse>(`manager-reviews:${activeLocationId}:${revision}`, () => restApi.managerReviews.list({ locationId: activeLocationId }), Boolean(activeLocationId && !allStores));
  const dashboardQuery = useRestQueryState<DashboardData>(`manager-action-centre:${activeLocationId}:${revision}`, () => restApi.compliance.dashboard({ locationId: activeLocationId }), Boolean(activeLocationId && !allStores));
  const additionalQuery = useRestQueryState<AdditionalDashboard>(`manager-additional-action-centre:${activeLocationId}:${revision}`, () => restApi.additional.dashboard({ locationId: activeLocationId }), Boolean(activeLocationId && !allStores));
  const documentsQuery = useRestQueryState<ControlledDocumentSummary[]>(`controlled-documents:${activeLocationId}:${revision}`, () => restApi.reports.controlledDocuments({ locationId: activeLocationId }), Boolean(activeLocationId && !allStores));
  const allStoresQuery = useRestQueryState<AllStoreSummary>("manager-overview:all-stores", restApi.managerOverview.allStores, allStores && activeSection === "overview");
  const data = dataQuery.data;
  const dashboard = dashboardQuery.data;
  const additional = additionalQuery.data;
  const controlledDocuments = documentsQuery.data;
  const complete = useRestMutation(restApi.managerReviews.complete);
  const addIssueUpdate = useRestMutation(restApi.compliance.addIssueUpdate);
  const actionCentre: ManagerActionCentre | null = dashboard && additional ? buildManagerActionCentre({ ...dashboard, additionalRequirements: additional.requirements, additionalCompletions: additional.completions }) : null;
  const timeZone = data?.location.timezone ?? dashboard?.location.timezone ?? "Europe/London";
  useEffect(() => {
    if (data && dashboard && additional) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastUpdated(Date.now());
    }
  }, [data, dashboard, additional]);

  const selectedIssueForDetail = selectedIssue ? {
    ...selectedIssue,
    _id: selectedIssue.id,
    updates: (selectedIssue.journey ?? []).map((event, index) => ({ _id: `${selectedIssue.id}-${index}`, updateType: event.eventType === "issue_resolved" ? "resolution" : event.eventType === "issue_recheck" ? "recheck" : event.eventType, note: event.detail, status: event.result, createdAt: event.occurredAt, teamMemberName: event.teamMemberName })),
  } : null;

  const submitWeekly = async () => {
    if (!data) return;
    try {
      if (!data.periods.weekly.available || !data.periods.weekly.start || !data.periods.weekly.end) return;
      await complete({ locationId: activeLocationId, reviewType: "weekly", periodStart: data.periods.weekly.start, periodEnd: data.periods.weekly.end, issueUpdates: data.currentIssues.map((issue) => ({ issueId: issue.id, note: weeklyNotes[issue.id]?.trim() ?? "", status: weeklyStatuses[issue.id] ?? issue.status })) });
      toast.success("Weekly review completed");
      setWeeklyNotes({}); setWeeklyStatuses({}); onDirtyChange(false);
      setRevision(value => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete weekly review");
    }
  };

  const submitFourWeekly = async () => {
    if (!data) return;
    try {
      if (!data.periods.four_weekly.available || !data.periods.four_weekly.start || !data.periods.four_weekly.end) return;
      await complete({ locationId: activeLocationId, reviewType: "four_weekly", periodStart: data.periods.four_weekly.start, periodEnd: data.periods.four_weekly.end, seriousProblems: seriousProblems === "yes", details, actionTaken, answers });
      toast.success("4-weekly review completed");
      setSeriousProblems("no"); setDetails(""); setActionTaken(""); setAnswers(Object.fromEntries(FSA_QUESTIONS.map((_, index) => [String(index + 1), "yes"])) as Record<string, "yes" | "no">); onDirtyChange(false);
      setRevision(value => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete 4-weekly review");
    }
  };

  const periodSummary = (period: Period) => <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><div className={`col-span-2 rounded-xl p-3 font-semibold sm:col-span-5 ${period.status === "overdue" ? "bg-[#fff8f6] text-[#a13d32]" : period.status === "up_to_date" ? "bg-[#fbfefb] text-[#2d7951]" : "bg-[#fafbf9]"}`}>{periodStatusLabel(period)}</div><div className="rounded-xl bg-[#fafbf9] p-3">Raised <b className="float-right">{period.summary.issuesRaised}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Resolved <b className="float-right">{period.summary.issuesResolved}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Outstanding <b className="float-right">{period.summary.outstandingIssues}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Actions / rechecks <b className="float-right">{(period.summary.correctiveActions ?? 0) + (period.summary.rechecks ?? 0)}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed temperatures <b className="float-right">{period.summary.failedTemperatureChecks}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed probes <b className="float-right">{period.summary.failedProbeChecks}</b></div></div>;

  const managerDirty = Object.keys(weeklyNotes).length > 0 || Object.keys(weeklyStatuses).length > 0 || seriousProblems !== "no" || details.length > 0 || actionTaken.length > 0 || Object.values(answers).some(value => value !== "yes");
  useEffect(() => { onDirtyChange(managerDirty); }, [managerDirty, onDirtyChange]);
  const changeStore = (next: string) => onRequestNavigation(() => { onStoreChange(next); setActiveLocationId(next); setRevision(value => value + 1); setSelectedIssue(null); setWeeklyNotes({}); setWeeklyStatuses({}); setSeriousProblems("no"); setDetails(""); setActionTaken(""); setAnswers(Object.fromEntries(FSA_QUESTIONS.map((_, index) => [String(index + 1), "yes"])) as Record<string, "yes" | "no">); onDirtyChange(false); });
  const openIssue = (id: string) => { const issue = data?.currentIssues.find(item => item.id === id); if (issue) setSelectedIssue(issue); onActiveSectionChange("issues"); };
  const openReview = (type: "weekly" | "four_weekly") => { onActiveSectionChange("reviews"); window.setTimeout(() => document.getElementById(type === "weekly" ? "weekly-review" : "four-week-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const sections: Array<[ManagerOverviewSection, string]> = [["overview", "Overview"], ["issues", "Issues"], ["reviews", "Reviews"], ["history", "History"]];
  const selectSection = (section: ManagerOverviewSection) => {
    if (allStores && section !== "overview") onAllStoresChange(false);
    onActiveSectionChange(section);
  };

  return <div className="min-h-screen bg-white text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8"><div><p className="text-lg font-semibold">Manager Overview</p><p className="text-xs text-[#737a74]">Store management</p></div><Button variant="outline" onClick={returnToAllStores ? onReturnToAllStores : onBack}><ArrowLeft className="mr-2 size-4" />{returnToAllStores ? "All stores" : "Daily Checks"}</Button></div></header>
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-5 pb-32 sm:px-8 sm:pb-36">
      <section className="flex flex-col gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 sm:flex-row sm:items-end sm:justify-between">
        {allStores
          ? <div><p className="text-sm font-semibold">All stores</p><p className="mt-1 text-xs text-[#737a74]">Separate summaries for stores you are authorised to manage.</p></div>
          : <label className="text-sm font-semibold">Selected store<select value={activeLocationId} onChange={event => changeStore(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 sm:w-80">{locations.map(location => <option key={locationIdOf(location)} value={locationIdOf(location)}>{location.name}</option>)}</select></label>}
        {locations.length > 1 && <Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => { onAllStoresChange(!allStores); onActiveSectionChange("overview"); }}>{allStores ? "This store" : "All stores"}</Button>}
      </section>
      {!allStores && <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-black/[0.07] bg-white p-2" aria-label="Manager Overview sections" role="tablist">{sections.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={activeSection === id} onClick={() => selectSection(id)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow ${activeSection === id ? "bg-[#FFDE56] text-[#202522]" : "text-[#606861] hover:bg-[#fafbf9]"}`}>{label}</button>)}</nav>}
      {allStores && activeSection === "overview" && <section aria-label="Store summaries" className="space-y-3">
        {allStoresQuery.loading && <p role="status" className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#606861]">Loading store summaries…</p>}
        {allStoresQuery.error && <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-[#efc8c3] bg-white p-4 text-sm text-[#a13d32] sm:flex-row sm:items-center sm:justify-between"><span>Store summaries could not be loaded.</span><Button variant="outline" className="min-h-11" onClick={allStoresQuery.retry}><RefreshCw className="mr-2 size-4" />Retry</Button></div>}
        {allStoresQuery.data?.stores.map(store => <article key={store.location.id} className="rounded-2xl border border-black/[0.07] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold">{store.location.name}</h2><p className="mt-1 text-xs text-[#737a74]">Local date · {store.location.timezone}</p></div><Button variant="outline" className="min-h-11 w-full sm:w-auto" onClick={() => onSelectAllStore(store.location.id)}>Open Manager Overview<ArrowLeft className="ml-2 size-4 rotate-180" /></Button></div>
          {store.state === "error" || !store.summary
            ? <p role="status" className="mt-4 rounded-xl border border-[#ead797] bg-white p-3 text-sm text-[#765c17]">Summary unavailable for this store. Other store summaries remain available.</p>
            : <><dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Required checks outstanding", store.summary.checksOutstanding], ["Unresolved issues", store.summary.unresolvedIssues], ["Scheduled cleaning outstanding", store.summary.cleaningOutstanding], ["Reviews due", store.summary.reviewsDue]].map(([label, count]) => <div key={String(label)} className="rounded-xl border border-black/[0.06] p-3"><dt className="text-xs text-[#737a74]">{label}</dt><dd className="mt-1 text-lg font-semibold">{count}</dd></div>)}</dl>{store.summary.dueLater > 0 && <p className="mt-3 rounded-xl bg-[#f7f8f6] p-3 text-sm text-[#606861]">{store.summary.dueLater} required item{store.summary.dueLater === 1 ? "" : "s"} due later today</p>}<p className="mt-3 text-xs text-[#737a74]">Updated {store.updatedAt ? timeLabel(store.updatedAt, store.location.timezone) : "time unavailable"}</p></>}
        </article>)}
        {allStoresQuery.data && allStoresQuery.data.stores.length === 0 && <p className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#606861]">No active stores are available to manage.</p>}
      </section>}
      {!allStores && (dataQuery.loading || dashboardQuery.loading || additionalQuery.loading) && <section className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#606861]">Loading manager data…</section>}
      {!allStores && (dataQuery.error || dashboardQuery.error || additionalQuery.error) && <section role="alert" className="rounded-2xl border border-[#efc8c3] bg-white p-5 text-sm text-[#a13d32]">Manager data could not be loaded. {dataQuery.error?.message ?? dashboardQuery.error?.message ?? additionalQuery.error?.message}</section>}
      {!allStores && activeSection === "overview" && data && actionCentre && additional && dashboard && <ManagerOverviewPanel issues={data.currentIssues} centre={actionCentre} cleaningTasks={dashboard.cleaningTasks ?? []} additionalRequirements={additional.requirements} additionalCompletions={additional.completions} timezone={data.location.timezone} weekly={data.periods.weekly} fourWeekly={data.periods.four_weekly} documents={controlledDocuments} locationName={data.location.name} updatedAt={lastUpdated ? timeLabel(new Date(lastUpdated).toISOString(), timeZone) : "Updating…"} onTask={target => onOpenTask(activeLocationId, target)} onIssue={openIssue} onReview={openReview} />}
      {activeSection === "issues" && data && <div className="space-y-4">        <section id="current-issues" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Current issues</p><h1 className="mt-1 text-2xl font-semibold">Open and monitoring</h1></div><ClipboardCheck className="size-6 text-[#89918b]" /></div><div className="mt-5 space-y-3">{data.currentIssues.map(issue => { const presentation = issueStatusPresentation(issue.status); const StatusIcon = presentation.icon; return <div key={issue.id} className={`rounded-xl p-4 ${issue.status === "monitoring" ? "bg-[#fffdf4]" : "bg-[#fff8f6]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">{issue.description}</p><p className="mt-2 text-xs text-[#89918b]">{issue.category} · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className="size-3.5" aria-hidden="true" />{presentation.label}</span></div>{issue.latestAction && <p className="mt-3 text-sm"><b>Latest action:</b> {issue.latestAction}</p>}{issue.latestRecheck && <p className="mt-1 text-sm"><b>Latest recheck:</b> {issue.latestRecheck.temperature}°C · {issue.latestRecheck.result}</p>}<Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedIssue(issue)}>View issue</Button></div>; })}{!data.currentIssues.length && <p className="text-sm text-[#727a74]">No current issues.</p>}</div></section>

        <section id="resolved-issues" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Resolved issues</p><h2 className="mt-1 text-2xl font-semibold">Completed audit journeys</h2><div className="mt-5 space-y-3">{data.resolvedIssues.map(issue => <div key={issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafbf9] p-4"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">Resolved · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe3c9] bg-[#effaf1] px-3 py-1 text-xs font-semibold text-[#216c45]"><CheckCircle2 className="size-3.5" aria-hidden="true" />Resolved</span><Button variant="outline" size="sm" onClick={() => setSelectedIssue(issue)}>View issue</Button></div></div>)}{!data.resolvedIssues.length && <p className="text-sm text-[#727a74]">No resolved issues recorded.</p>}</div></section>


      </div>}
      {activeSection === "reviews" && data && <div className="space-y-4">        <section id="weekly-review" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">Weekly review</h2>{data.periods.weekly.start && data.periods.weekly.end ? <p className="mt-1 text-sm text-[#727a74]">Week {data.periods.weekly.start} – {data.periods.weekly.end}</p> : <p className="mt-1 text-sm text-[#727a74]">Next weekly review available after Sunday {data.periods.weekly.nextAvailableAfter}</p>}{periodSummary(data.periods.weekly)}{data.periods.weekly.available && !data.periods.weekly.completed && <div className="mt-5 space-y-3">{data.currentIssues.length ? data.currentIssues.map(issue => <label key={issue.id} className="block text-sm font-semibold">{issue.title}<select value={weeklyStatuses[issue.id] ?? issue.status} onChange={event => setWeeklyStatuses(current => ({ ...current, [issue.id]: event.target.value as "open" | "monitoring" | "resolved" }))} className="mt-2 h-10 w-full rounded-xl border border-black/[0.1] bg-white px-2 text-sm"><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select><Input value={weeklyNotes[issue.id] ?? ""} onChange={event => setWeeklyNotes(current => ({ ...current, [issue.id]: event.target.value }))} placeholder="Current position / next action" className="mt-2 h-11" /></label>) : <p className="rounded-xl bg-[#fafbf9] p-4 text-sm text-[#727a74]">No issues requiring manager follow-up this week.</p>}<Button className="mt-2 bg-[#202522] text-white" onClick={submitWeekly}>Complete weekly review</Button></div>} {data.periods.weekly.status === "up_to_date" && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Up to date</p>} {data.periods.weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Weekly review completed</p>}</section>

        <section id="four-week-review" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">4-week review</h2>{data.periods.four_weekly.start && data.periods.four_weekly.end ? <p className="mt-1 text-sm text-[#727a74]">{data.periods.four_weekly.start} – {data.periods.four_weekly.end}</p> : <p className="mt-1 text-sm text-[#727a74]">Next 4-week review available after {data.periods.four_weekly.nextAvailableAfter}</p>}{periodSummary(data.periods.four_weekly)}{data.periods.four_weekly.summary.repeatProblems.length > 0 && <div className="mt-4 rounded-xl border border-[#f0d98a] bg-[#fffdf4] p-4 text-sm"><b>Repeated problems highlighted:</b> {data.periods.four_weekly.summary.repeatProblems.map(problem => `${problem.label} (${problem.count})`).join(", ")}</div>}{data.periods.four_weekly.available && !data.periods.four_weekly.completed && <div className="mt-5 space-y-4"><p className="font-semibold">Did you observe any serious problems or did the same issue occur three times or more?</p><div className="flex gap-2"><Button variant={seriousProblems === "yes" ? "default" : "outline"} onClick={() => setSeriousProblems("yes")}>Yes</Button><Button variant={seriousProblems === "no" ? "default" : "outline"} onClick={() => setSeriousProblems("no")}>No</Button></div>{seriousProblems === "yes" && <><label className="block text-sm font-semibold">Details<textarea value={details} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="block text-sm font-semibold">What did you do about it?<textarea value={actionTaken} onChange={event => setActionTaken(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label></>}<div className="space-y-3"><p className="font-semibold">Safe method review</p>{FSA_QUESTIONS.map((question, index) => <label key={question} className="flex flex-col gap-2 rounded-xl bg-[#fafbf9] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{index + 1}. {question}</span><select value={answers[String(index + 1)]} onChange={event => setAnswers(current => ({ ...current, [String(index + 1)]: event.target.value as "yes" | "no" }))} className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 sm:w-24"><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div><Button className="bg-[#202522] text-white" onClick={submitFourWeekly}>Complete 4-week review</Button></div>} {data.periods.four_weekly.status === "up_to_date" && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Up to date</p>} {data.periods.four_weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> 4-week review completed</p>}</section>


      </div>}
      {activeSection === "history" && data && <div className="space-y-4">        <section id="review-history" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Review history</p><h2 className="mt-1 text-2xl font-semibold">Completed reviews</h2><div className="mt-5 space-y-3">{data.reviewHistory.map(review => <details key={review.id} className="rounded-xl bg-[#fafbf9] p-4"><summary className="cursor-pointer font-semibold">{reviewTypeLabel(review.reviewType)} · {review.periodStart} – {review.periodEnd}</summary><p className="mt-2 text-sm text-[#727a74]">Completed by {review.completedBy} · {timeLabel(review.completedAt, data.location.timezone)}</p>{review.seriousProblems !== null && <p className="mt-2 text-sm">Serious problems / repeated issue: {review.seriousProblems ? "Yes" : "No"}</p>}{review.details && <p className="mt-2 text-sm"><b>Details:</b> {review.details}</p>}{review.actionTaken && <p className="mt-2 text-sm"><b>Action taken:</b> {review.actionTaken}</p>}{review.answers && <div className="mt-3 space-y-1 text-sm">{FSA_QUESTIONS.map((question, index) => <p key={question}>{index + 1}. {review.answers?.[String(index + 1)] === "yes" ? "Yes" : "No"} · {question}</p>)}</div>}</details>)}{!data.reviewHistory.length && <p className="text-sm text-[#727a74]">No completed manager reviews yet.</p>}</div></section>
      </div>}
    </main>
    {selectedIssueForDetail && <IssueDetail issue={selectedIssueForDetail} teamMembers={data?.teamMembers ?? []} onUpdate={async (args: Record<string, unknown>) => { await addIssueUpdate(args); setSelectedIssue(null); setRevision(value => value + 1); toast.success("Issue update saved"); }} onClose={() => setSelectedIssue(null)} />}
  </div>;
}
