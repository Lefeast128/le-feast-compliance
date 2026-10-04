import IssueJourneyDialog from "@/components/IssueJourneyDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restApi, useRestMutation, useRestQuery } from "@/lib/rest-domain";
import { ArrowLeft, CheckCircle2, ClipboardCheck } from "lucide-react";
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
};
type Period = { reviewType: string; start: string; end: string; completed: boolean; summary: { issuesRaised: number; issuesResolved: number; outstandingIssues: number; failedTemperatureChecks: number; failedProbeChecks: number; otherIssues: number; repeatProblems: Array<{ label: string; count: number }> } };
type Review = { id: string; reviewType: string; periodStart: string; periodEnd: string; completedAt: string; completedBy: string; summary: Period["summary"]; seriousProblems: boolean | null; details: string | null; actionTaken: string | null; answers: Record<string, string> | null };
type ReviewResponse = { location: { id: string; name: string; timezone: string }; periods: { weekly: Period; four_weekly: Period }; currentIssues: Issue[]; resolvedIssues: Issue[]; reviewHistory: Review[] };
type Props = { locationId: string; locations: Location[]; onBack: () => void };

const locationIdOf = (location: Location) => location._id ?? location.id ?? "";
const timeLabel = (value: string | null | undefined, timeZone: string) => value ? new Intl.DateTimeFormat("en-GB", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Time not recorded";
const reviewTypeLabel = (value: string) => value === "four_weekly" ? "4-Weekly Review" : "Weekly Review";

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

export default function ManagerReviews({ locationId, locations, onBack }: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locationId);
  const [revision, setRevision] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [weeklyNotes, setWeeklyNotes] = useState<Record<string, string>>({});
  const [seriousProblems, setSeriousProblems] = useState<"yes" | "no">("no");
  const [details, setDetails] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>(() => Object.fromEntries(FSA_QUESTIONS.map((_, index) => [String(index + 1), "yes"])) as Record<string, "yes" | "no">);
  const data = useRestQuery<ReviewResponse>(`manager-reviews:${activeLocationId}:${revision}`, () => restApi.managerReviews.list({ locationId: activeLocationId }), Boolean(activeLocationId));
  const complete = useRestMutation(restApi.managerReviews.complete);

  const submitWeekly = async () => {
    if (!data) return;
    try {
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
      await complete({ locationId: activeLocationId, reviewType: "four_weekly", periodStart: data.periods.four_weekly.start, periodEnd: data.periods.four_weekly.end, seriousProblems: seriousProblems === "yes", details, actionTaken, answers });
      toast.success("4-weekly review completed");
      setRevision(value => value + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete 4-weekly review");
    }
  };

  const periodSummary = (period: Period) => <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5"><div className="rounded-xl bg-[#fafbf9] p-3">Raised <b className="float-right">{period.summary.issuesRaised}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Resolved <b className="float-right">{period.summary.issuesResolved}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Outstanding <b className="float-right">{period.summary.outstandingIssues}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed temperatures <b className="float-right">{period.summary.failedTemperatureChecks}</b></div><div className="rounded-xl bg-[#fafbf9] p-3">Failed probes <b className="float-right">{period.summary.failedProbeChecks}</b></div></div>;

  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-8"><div><p className="text-[15px] font-semibold">Issues &amp; Reviews</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Manager controls</p></div><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to setup</Button></div></header>
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8">
      <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><label className="text-sm font-semibold">Store<select value={activeLocationId} onChange={event => { setActiveLocationId(event.target.value); setRevision(value => value + 1); setWeeklyNotes({}); }} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 sm:w-80">{locations.map(location => <option key={locationIdOf(location)} value={locationIdOf(location)}>{location.name}</option>)}</select></label></section>
      {!data && <section className="rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">Loading manager reviews…</section>}
      {data && <>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Current issues</p><h1 className="mt-1 text-2xl font-semibold">Open and monitoring</h1></div><ClipboardCheck className="size-6 text-[#89918b]" /></div><div className="mt-5 space-y-3">{data.currentIssues.map(issue => <div key={issue.id} className="rounded-xl bg-[#fff8f6] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">{issue.description}</p><p className="mt-2 text-xs text-[#89918b]">{issue.category} · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><span className="rounded-full bg-[#fce5df] px-3 py-1 text-xs font-semibold">{issue.status === "monitoring" ? "Monitoring" : "Open"}</span></div>{issue.latestAction && <p className="mt-3 text-sm"><b>Latest action:</b> {issue.latestAction}</p>}{issue.latestRecheck && <p className="mt-1 text-sm"><b>Latest recheck:</b> {issue.latestRecheck.temperature}°C · {issue.latestRecheck.result}</p>}<Button variant="outline" size="sm" className="mt-3" onClick={() => setSelectedIssue(issue)}>View issue</Button></div>)}{!data.currentIssues.length && <p className="text-sm text-[#727a74]">No current issues.</p>}</div></section>

        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Resolved issues</p><h2 className="mt-1 text-2xl font-semibold">Completed audit journeys</h2><div className="mt-5 space-y-3">{data.resolvedIssues.map(issue => <div key={issue.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fafbf9] p-4"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">Resolved · {issue.createdByName ?? "Not recorded"} · {timeLabel(issue.createdAt, data.location.timezone)}</p></div><Button variant="outline" size="sm" onClick={() => setSelectedIssue(issue)}>View issue</Button></div>)}{!data.resolvedIssues.length && <p className="text-sm text-[#727a74]">No resolved issues recorded.</p>}</div></section>

        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">Weekly review</h2><p className="mt-1 text-sm text-[#727a74]">Week {data.periods.weekly.start} – {data.periods.weekly.end}</p>{periodSummary(data.periods.weekly)}{!data.periods.weekly.completed && <div className="mt-5 space-y-3">{data.currentIssues.length ? data.currentIssues.map(issue => <label key={issue.id} className="block text-sm font-semibold">{issue.title}<Input value={weeklyNotes[issue.id] ?? ""} onChange={event => setWeeklyNotes(current => ({ ...current, [issue.id]: event.target.value }))} placeholder="Current position / next action" className="mt-2 h-11" /></label>) : <p className="rounded-xl bg-[#fafbf9] p-4 text-sm text-[#727a74]">No issues requiring manager follow-up this week.</p>}<Button className="mt-2 bg-[#202522] text-white" onClick={submitWeekly}>Complete weekly review</Button></div>} {data.periods.weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> Weekly review completed</p>}</section>

        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p><h2 className="mt-1 text-2xl font-semibold">4-week review</h2><p className="mt-1 text-sm text-[#727a74]">{data.periods.four_weekly.start} – {data.periods.four_weekly.end}</p>{periodSummary(data.periods.four_weekly)}{data.periods.four_weekly.summary.repeatProblems.length > 0 && <div className="mt-4 rounded-xl border border-[#f0d98a] bg-[#fffdf4] p-4 text-sm"><b>Repeated problems highlighted:</b> {data.periods.four_weekly.summary.repeatProblems.map(problem => `${problem.label} (${problem.count})`).join(", ")}</div>}{!data.periods.four_weekly.completed && <div className="mt-5 space-y-4"><p className="font-semibold">Did you observe any serious problems or did the same issue occur three times or more?</p><div className="flex gap-2"><Button variant={seriousProblems === "yes" ? "default" : "outline"} onClick={() => setSeriousProblems("yes")}>Yes</Button><Button variant={seriousProblems === "no" ? "default" : "outline"} onClick={() => setSeriousProblems("no")}>No</Button></div>{seriousProblems === "yes" && <><label className="block text-sm font-semibold">Details<textarea value={details} onChange={event => setDetails(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="block text-sm font-semibold">What did you do about it?<textarea value={actionTaken} onChange={event => setActionTaken(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label></>}<div className="space-y-3"><p className="font-semibold">Safe method review</p>{FSA_QUESTIONS.map((question, index) => <label key={question} className="flex flex-col gap-2 rounded-xl bg-[#fafbf9] p-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span>{index + 1}. {question}</span><select value={answers[String(index + 1)]} onChange={event => setAnswers(current => ({ ...current, [String(index + 1)]: event.target.value as "yes" | "no" }))} className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 sm:w-24"><option value="yes">Yes</option><option value="no">No</option></select></label>)}</div><Button className="bg-[#202522] text-white" onClick={submitFourWeekly}>Complete 4-week review</Button></div>} {data.periods.four_weekly.completed && <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#2d7951]"><CheckCircle2 className="size-4" /> 4-week review completed</p>}</section>

        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Review history</p><h2 className="mt-1 text-2xl font-semibold">Completed reviews</h2><div className="mt-5 space-y-3">{data.reviewHistory.map(review => <details key={review.id} className="rounded-xl bg-[#fafbf9] p-4"><summary className="cursor-pointer font-semibold">{reviewTypeLabel(review.reviewType)} · {review.periodStart} – {review.periodEnd}</summary><p className="mt-2 text-sm text-[#727a74]">Completed by {review.completedBy} · {timeLabel(review.completedAt, data.location.timezone)}</p>{review.seriousProblems !== null && <p className="mt-2 text-sm">Serious problems / repeated issue: {review.seriousProblems ? "Yes" : "No"}</p>}{review.details && <p className="mt-2 text-sm"><b>Details:</b> {review.details}</p>}{review.actionTaken && <p className="mt-2 text-sm"><b>Action taken:</b> {review.actionTaken}</p>}{review.answers && <div className="mt-3 space-y-1 text-sm">{FSA_QUESTIONS.map((question, index) => <p key={question}>{index + 1}. {review.answers?.[String(index + 1)] === "yes" ? "Yes" : "No"} · {question}</p>)}</div>}</details>)}{!data.reviewHistory.length && <p className="text-sm text-[#727a74]">No completed manager reviews yet.</p>}</div></section>
      </>}
    </main>
    {selectedIssue && <IssueJourneyDialog issue={selectedIssue} timeZone={data?.location.timezone ?? "Europe/London"} onClose={() => setSelectedIssue(null)} />}
  </div>;
}
