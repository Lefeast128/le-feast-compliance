import IssueDetail from "@/components/IssueDetail";
import type { DashboardData } from "@/components/dashboard/dashboard-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildManagerActionCentre, countManagerAttention, type ManagerActionCentre, type ManagerActionStatus } from "@/lib/manager-action-centre";
import { restApi, useRestMutation, useRestQuery } from "@/lib/rest-domain";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, ChevronRight, Clock3, XCircle } from "lucide-react";
import { useState } from "react";
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
type Props = { locationId: string; locations: Location[]; onBack: () => void; onOpenDailyChecks?: (locationId: string) => void };

const locationIdOf = (location: Location) => location._id ?? location.id ?? "";
const timeLabel = (value: string | null | undefined, timeZone: string) => value ? new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Time not recorded";
const reviewTypeLabel = (value: string) => value === "four_weekly" ? "4-Weekly Review" : "Weekly Review";
const periodStatusLabel = (period: Period) => period.status === "complete" ? "Complete" : period.status === "up_to_date" ? "Up to date" : period.status === "overdue" ? "Overdue" : period.daysUntilDue > 0 ? `Due in ${period.daysUntilDue} days` : "Due";
const issueStatusPresentation = (status: string) => status === "monitoring"
  ? { label: "Monitoring", className: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle }
  : { label: "Open", className: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]", icon: XCircle };

const actionStatusPresentation = (status: ManagerActionStatus) => {
  if (status === "complete") return { label: "Complete", className: "border-[#bfe3c9] bg-[#effaf1] text-[#216c45]", icon: CheckCircle2 };
  if (status === "overdue") return { label: "Overdue", className: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]", icon: XCircle };
  if (status === "not_due") return { label: "Not due yet", className: "border-[#dfe3dd] bg-[#f4f5f3] text-[#727a74]", icon: Clock3 };
  if (status === "due_later") return { label: "Due later", className: "border-[#dfe3dd] bg-[#f4f5f3] text-[#727a74]", icon: Clock3 };
  if (status === "in_progress") return { label: "In progress", className: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle };
  return { label: "Due now", className: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle };
};

function ActionCentreCard({ label, detail, status, count, onOpen }: { label: string; detail: string; status: ManagerActionStatus; count?: string; onOpen?: () => void }) {
  const presentation = actionStatusPresentation(status);
  const Icon = presentation.icon;
  return <div className="rounded-xl border border-black/[0.07] bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="font-semibold">{label}</p><p className="mt-1 text-sm text-[#727a74]">{detail}</p></div>
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${presentation.className}`}><Icon className="size-3.5" aria-hidden="true" />{count ?? presentation.label}</span>
    </div>
    {onOpen && <Button variant="outline" size="sm" className="mt-3" onClick={onOpen}>Open Daily Checks <ChevronRight className="ml-1 size-4" /></Button>}
  </div>;
}

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

export default function ManagerReviews({ locationId, locations, onBack, onOpenDailyChecks }: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locationId);
  const [revision, setRevision] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [weeklyNotes, setWeeklyNotes] = useState<Record<string, string>>({});
  const [seriousProblems, setSeriousProblems] = useState<"yes" | "no">("no");
  const [details, setDetails] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>(() => Object.fromEntries(FSA_QUESTIONS.map((_, index) => [String(index + 1), "yes"])) as Record<string, "yes" | "no">);
  const data = useRestQuery<ReviewResponse>(`manager-reviews:${activeLocationId}:${revision}`, () => restApi.managerReviews.list({ locationId: activeLocationId }), Boolean(activeLocationId));
  const dashboard = useRestQuery<DashboardData>(`manager-action-centre:${activeLocationId}:${revision}`, () => restApi.compliance.dashboard({ locationId: activeLocationId }), Boolean(activeLocationId));
  const complete = useRestMutation(restApi.managerReviews.complete);
  const addIssueUpdate = useRestMutation(restApi.compliance.addIssueUpdate);
  const actionCentre: ManagerActionCentre | null = dashboard ? buildManagerActionCentre(dashboard) : null;
  const openDailyChecks = onOpenDailyChecks ? () => onOpenDailyChecks(activeLocationId) : undefined;

  const selectedIssueForDetail = selectedIssue ? {
    ...selectedIssue,
    _id: selectedIssue.id,
    updates: (selectedIssue.journey ?? []).map((event, index) => ({ _id: `${selectedIssue.id}-${index}`, updateType: event.eventType === "issue_resolved" ? "resolution" : event.eventType === "issue_recheck" ? "recheck" : event.eventType, note: event.detail, status: event.result, createdAt: event.occurredAt, teamMemberName: event.teamMemberName })),
  } : null;

  const submitWeekly = async () => {
    if (!data) return;
    try {
      if (!data.periods.weekly.available || !data.periods.weekly.start || !data.periods.weekly.end) return;
      await complete({ locationId: activeLocationId, reviewType: "weekly", periodStart: data.periods.weekly.start, periodEnd: data.periods.weekly.end, issueUpdates: Object.entries(weeklyNotes).filter(([, note]) => note.trim()).map(([issueId, note]) => ({ issueId, note: note.trim() })) });
      toast.success("Weekly review completed");
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
      setRevision(value => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete 4-weekly review");
    }
  };

  const periodSummary = (period: Period) => <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><div className={`col-span-2 rounded-xl p-3 font-semibold sm:col-span-5 ${period.status === "overdue" ? "bg-[#fff8f6] text-[#a13d32]" : period.status === "up_to_date" ? "bg-[#fbfefb] text-[#2d7951]" : "bg-[#fafbf9]"}`}>{periodStatusLabel(period)}</div><div className="rounded-xl bg-[#fafbf9] p-3">Raised <b className="float-right">{period.summary.issuesRaised}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Resolved <b className="float-right">{period.summary.issuesResolved}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Outstanding <b className="float-right">{period.summary.outstandingIssues}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Actions / rechecks <b className="float-right">{(period.summary.correctiveActions ?? 0) + (period.summary.rechecks ?? 0)}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed temperatures <b className="float-right">{period.summary.failedTemperatureChecks}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed probes <b className="float-right">{period.summary.failedProbeChecks}</b></div></div>;

  const attentionCount = data ? countManagerAttention(data.currentIssues.length, [data.periods.weekly, data.periods.four_weekly].filter(period => period.status === "due" || period.status === "overdue").length, actionCentre) : 0;
  const navigation = [
    ["Current issues", "current-issues"],
    ["Resolved", "resolved-issues"],
    ["Weekly review", "weekly-review"],
    ["4-week review", "four-week-review"],
    ["History", "review-history"],
  ] as const;

  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8"><div><p className="text-[15px] font-semibold">Issues &amp; Reviews</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Manager controls</p></div><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to setup</Button></div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><label className="text-sm font-semibold">Store<select value={activeLocationId} onChange={event => { setActiveLocationId(event.target.value); setRevision(value => value + 1); setWeeklyNotes({}); }} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 sm:w-80">{locations.map(location => <option key={locationIdOf(location)} value={locationIdOf(location)}>{location.name}</option>)}</select></label></section>
      {!data && <section className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">Loading manager reviews…</section>}
      {data && <>
        <section className="rounded-2xl border border-[#ead797] bg-[#fffdf4] p-5" aria-label="Manager review summary"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">At a glance</p><h1 className="mt-1 text-2xl font-semibold">Manager review summary</h1><p className="mt-2 text-sm text-[#727a74]">{attentionCount ? `${attentionCount} item${attentionCount === 1 ? "" : "s"} need attention` : "No current review actions need attention"}</p></div><ClipboardCheck className="size-6 text-[#8a6513]" /></div><div className="mt-5 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div className="rounded-xl bg-white p-3"><span className="block text-xs text-[#89918b]">Open / monitoring</span><b className="mt-1 block text-lg">{data.currentIssues.length}</b></div><div className="rounded-xl bg-white p-3"><span className="block text-xs text-[#89918b]">Resolved</span><b className="mt-1 block text-lg">{data.resolvedIssues.length}</b></div><div className="rounded-xl bg-white p-3"><span className="block text-xs text-[#89918b]">Weekly</span><b className="mt-1 block text-lg">{periodStatusLabel(data.periods.weekly)}</b></div><div className="rounded-xl bg-white p-3"><span className="block text-xs text-[#89918b]">4-week</span><b className="mt-1 block text-lg">{periodStatusLabel(data.periods.four_weekly)}</b></div></div></section>
        <nav className="rounded-2xl border border-black/[0.07] bg-white p-3" aria-label="Manager review sections"><div className="flex flex-wrap gap-2">{navigation.map(([label, id]) => <a key={id} href={`#${id}`} className="inline-flex min-h-10 items-center rounded-xl border border-black/[0.08] px-3 text-sm font-semibold text-[#4e5851] transition hover:bg-[#fafbf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde56]">{label}<ChevronRight className="ml-1 size-4" aria-hidden="true" /></a>)}</div></nav>
        <section id="action-centre" className="scroll-mt-24 rounded-2xl border border-[#ead797] bg-[#fffdf4] p-5" aria-label="Manager action centre">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Action centre</p><h2 className="mt-1 text-2xl font-semibold">What needs attention today</h2><p className="mt-2 text-sm text-[#727a74]">Required work is shown separately from issues that need follow-up.</p></div>
            {openDailyChecks && <Button variant="outline" onClick={openDailyChecks}>Open Daily Checks <ChevronRight className="ml-2 size-4" /></Button>}
          </div>
          {actionCentre ? <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{actionCentre.required.map(item => <ActionCentreCard key={item.id} label={item.label} detail={item.detail} status={item.status} onOpen={item.requiresAttention ? openDailyChecks : undefined} />)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={`rounded-xl border p-4 ${actionCentre.failedTemperatures ? "border-[#efc8c3] bg-[#fff3f1]" : "border-black/[0.07] bg-white"}`}><p className="font-semibold">Failed temperatures</p><p className="mt-1 text-sm text-[#727a74]">{actionCentre.failedTemperatures ? `${actionCentre.failedTemperatures} reading${actionCentre.failedTemperatures === 1 ? "" : "s"} need follow-up.` : "No failed readings need follow-up."}</p><a href="#current-issues" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#8f3a31] underline-offset-4 hover:underline">Review issues <ChevronRight className="ml-1 size-4" /></a></div>
              <div className={`rounded-xl border p-4 ${actionCentre.unresolvedIssues ? "border-[#efc8c3] bg-[#fff8f6]" : "border-black/[0.07] bg-white"}`}><p className="font-semibold">Issues needing action</p><p className="mt-1 text-sm text-[#727a74]">{actionCentre.unresolvedIssues ? `${actionCentre.unresolvedIssues} open or monitoring issue${actionCentre.unresolvedIssues === 1 ? "" : "s"}.` : "No unresolved issues."}</p><a href="#current-issues" className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold text-[#8f3a31] underline-offset-4 hover:underline">Review issues <ChevronRight className="ml-1 size-4" /></a></div>
              <ActionCentreCard label="Cleaning" detail={actionCentre.cleaning.due ? `${actionCentre.cleaning.complete} of ${actionCentre.cleaning.due} due jobs complete.` : "No cleaning jobs are scheduled today."} status={actionCentre.cleaning.due === 0 ? "not_due" : actionCentre.cleaning.incomplete ? "due_now" : "complete"} count={actionCentre.cleaning.due === 0 ? "Nothing due" : undefined} onOpen={actionCentre.cleaning.incomplete ? openDailyChecks : undefined} />
              <ActionCentreCard label="After-use checks" detail={actionCentre.cleaning.afterUse ? `${actionCentre.cleaning.afterUseComplete} of ${actionCentre.cleaning.afterUse} recorded when used.` : "No after-use checks configured."} status="not_due" count={actionCentre.cleaning.afterUse ? "When used" : "None configured"} />
              <ActionCentreCard label="Additional checks" detail={actionCentre.additional.due ? `${actionCentre.additional.complete} of ${actionCentre.additional.due} due checks complete.` : "No additional checks are due today."} status={actionCentre.additional.due === 0 ? "not_due" : actionCentre.additional.overdue ? "overdue" : actionCentre.additional.incomplete ? "due_now" : "complete"} count={actionCentre.additional.due === 0 ? "Nothing due" : undefined} onOpen={actionCentre.additional.incomplete ? openDailyChecks : undefined} />
            </div>
            {!actionCentre.required.some(item => item.requiresAttention) && !actionCentre.failedTemperatures && !actionCentre.unresolvedIssues && !actionCentre.cleaning.incomplete && !actionCentre.additional.incomplete && <p className="mt-4 rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4 text-sm font-semibold text-[#2d7951]">No outstanding operational actions for this store.</p>}
          </> : <p className="mt-5 rounded-xl bg-white p-4 text-sm text-[#727a74]">Loading today&apos;s operational status…</p>}
        </section>
        <section id="current-issues" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Current issues</p><h1 className="mt-1 text-2xl font-semibold">Open and monitoring</h1></div><ClipboardCheck className="size-6 text-[#89918b]" /></div><div className="mt-5 space-y-3">{data.currentIssues.map(issue => { const presentation = issueStatusPresentation(issue.status); const StatusIcon = presentation.icon; return <div key={issue.id} className={`rounded-xl p-4 ${issue.status === "monitoring" ? "bg-[#fffdf4]" : "bg-[#fff8f6]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">{issue.description}</p><p className="mt-2 text-xs text-[#89918b]">{issue.category} · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className="size-3.5" aria-hidden="true" />{presentation.label}</span></div>{issue.latestAction && <p className="mt-3 text-sm"><b>Latest action:</b> {issue.latestAction}</p>}{issue.latestRecheck && <p className="mt-1 text-sm"><b>Latest recheck:</b> {issue.latestRecheck.temperature}°C · {issue.latestRecheck.result}</p>}<Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedIssue(issue)}>View issue</Button></div>; })}{!data.currentIssues.length && <p className="text-sm text-[#727a74]">No current issues.</p>}</div></section>

        <section id="resolved-issues" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Resolved issues</p><h2 className="mt-1 text-2xl font-semibold">Completed audit journeys</h2><div className="mt-5 space-y-3">{data.resolvedIssues.map(issue => <div key={issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafbf9] p-4"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">Resolved · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1.5 rounded-full border border-[#bfe3c9] bg-[#effaf1] px-3 py-1 text-xs font-semibold text-[#216c45]"><CheckCircle2 className="size-3.5" aria-hidden="true" />Resolved</span><Button variant="outline" size="sm" onClick={() => setSelectedIssue(issue)}>View issue</Button></div></div>)}{!data.resolvedIssues.length && <p className="text-sm text-[#727a74]">No resolved issues recorded.</p>}</div></section>

        <section id="weekly-review" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">Weekly review</h2>{data.periods.weekly.start && data.periods.weekly.end ? <p className="mt-1 text-sm text-[#727a74]">Week {data.periods.weekly.start} – {data.periods.weekly.end}</p> : <p className="mt-1 text-sm text-[#727a74]">Next weekly review available after Sunday {data.periods.weekly.nextAvailableAfter}</p>}{periodSummary(data.periods.weekly)}{data.periods.weekly.available && !data.periods.weekly.completed && <div className="mt-5 space-y-3">{data.currentIssues.length ? data.currentIssues.map(issue => <label key={issue.id} className="block text-sm font-semibold">{issue.title}<Input value={weeklyNotes[issue.id] ?? ""} onChange={event => setWeeklyNotes(current => ({ ...current, [issue.id]: event.target.value }))} placeholder="Current position / next action" className="mt-2 h-11" /></label>) : <p className="rounded-xl bg-[#fafbf9] p-4 text-sm text-[#727a74]">No issues requiring manager follow-up this week.</p>}<Button className="mt-2 bg-[#202522] text-white" onClick={submitWeekly}>Complete weekly review</Button></div>} {data.periods.weekly.status === "up_to_date" && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Up to date</p>} {data.periods.weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Weekly review completed</p>}</section>

        <section id="four-week-review" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">4-week review</h2>{data.periods.four_weekly.start && data.periods.four_weekly.end ? <p className="mt-1 text-sm text-[#727a74]">{data.periods.four_weekly.start} – {data.periods.four_weekly.end}</p> : <p className="mt-1 text-sm text-[#727a74]">Next 4-week review available after {data.periods.four_weekly.nextAvailableAfter}</p>}{periodSummary(data.periods.four_weekly)}{data.periods.four_weekly.summary.repeatProblems.length > 0 && <div className="mt-4 rounded-xl border border-[#f0d98a] bg-[#fffdf4] p-4 text-sm"><b>Repeated problems highlighted:</b> {data.periods.four_weekly.summary.repeatProblems.map(problem => `${problem.label} (${problem.count})`).join(", ")}</div>}{data.periods.four_weekly.available && !data.periods.four_weekly.completed && <div className="mt-5 space-y-4"><p className="font-semibold">Did you observe any serious problems or did the same issue occur three times or more?</p><div className="flex gap-2"><Button variant={seriousProblems === "yes" ? "default" : "outline"} onClick={() => setSeriousProblems("yes")}>Yes</Button><Button variant={seriousProblems === "no" ? "default" : "outline"} onClick={() => setSeriousProblems("no")}>No</Button></div>{seriousProblems === "yes" && <><label className="block text-sm font-semibold">Details<textarea value={details} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="block text-sm font-semibold">What did you do about it?<textarea value={actionTaken} onChange={event => setActionTaken(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label></>}<div className="space-y-3"><p className="font-semibold">Safe method review</p>{FSA_QUESTIONS.map((question, index) => <label key={question} className="flex flex-col gap-2 rounded-xl bg-[#fafbf9] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{index + 1}. {question}</span><select value={answers[String(index + 1)]} onChange={event => setAnswers(current => ({ ...current, [String(index + 1)]: event.target.value as "yes" | "no" }))} className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 sm:w-24"><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div><Button className="bg-[#202522] text-white" onClick={submitFourWeekly}>Complete 4-week review</Button></div>} {data.periods.four_weekly.status === "up_to_date" && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Up to date</p>} {data.periods.four_weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> 4-week review completed</p>}</section>

        <section id="review-history" className="scroll-mt-24 rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Review history</p><h2 className="mt-1 text-2xl font-semibold">Completed reviews</h2><div className="mt-5 space-y-3">{data.reviewHistory.map(review => <details key={review.id} className="rounded-xl bg-[#fafbf9] p-4"><summary className="cursor-pointer font-semibold">{reviewTypeLabel(review.reviewType)} · {review.periodStart} – {review.periodEnd}</summary><p className="mt-2 text-sm text-[#727a74]">Completed by {review.completedBy} · {timeLabel(review.completedAt, data.location.timezone)}</p>{review.seriousProblems !== null && <p className="mt-2 text-sm">Serious problems / repeated issue: {review.seriousProblems ? "Yes" : "No"}</p>}{review.details && <p className="mt-2 text-sm"><b>Details:</b> {review.details}</p>}{review.actionTaken && <p className="mt-2 text-sm"><b>Action taken:</b> {review.actionTaken}</p>}{review.answers && <div className="mt-3 space-y-1 text-sm">{FSA_QUESTIONS.map((question, index) => <p key={question}>{index + 1}. {review.answers?.[String(index + 1)] === "yes" ? "Yes" : "No"} · {question}</p>)}</div>}</details>)}{!data.reviewHistory.length && <p className="text-sm text-[#727a74]">No completed manager reviews yet.</p>}</div></section>
      </>}
    </main>
    {selectedIssueForDetail && <IssueDetail issue={selectedIssueForDetail} teamMembers={data?.teamMembers ?? []} onUpdate={async (args: Record<string, unknown>) => { await addIssueUpdate(args); setSelectedIssue(null); setRevision(value => value + 1); toast.success("Issue update saved"); }} onClose={() => setSelectedIssue(null)} />}
  </div>;
}
