import { Button } from "@/components/ui/button";
import { buildManagerOverviewActions, type ManagerOverviewTarget } from "@/lib/manager-overview";
import type { ManagerActionCentre } from "@/lib/manager-action-centre";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, XCircle } from "lucide-react";

type Issue = { id: string; title: string; status: string; category?: string | null; description?: string | null; originalReading?: string | null; createdByName?: string | null; teamMemberName?: string | null; latestAction?: string | null };
type Period = { status: string; start?: string | null; end?: string | null };
type Document = { id: string; title: string; version: number; acknowledgement: { completionPercentage: number; deadline: string | null; overdue: boolean } };
type Props = {
  issues: Issue[];
  centre: ManagerActionCentre;
  cleaningTasks: Array<{ _id: string; title?: string; name?: string }>;
  additionalRequirements: Array<{ _id: string; title: string; nextDueAt: string | number }>;
  additionalCompletions: Array<{ requirementId?: string; requirementRootId?: string | null; nextDueAt?: string | number | null; scheduledDueAt?: string | number | null }>;
  timezone: string;
  weekly: Period;
  fourWeekly: Period;
  documents?: Document[];
  locationName: string;
  updatedAt: string;
  onTask: (target: ManagerOverviewTarget) => void;
  onIssue: (issueId: string) => void;
  onReview: (reviewType: "weekly" | "four_weekly") => void;
};

export default function ManagerOverviewPanel(props: Props) {
  const model = buildManagerOverviewActions({ issues: props.issues, centre: props.centre, cleaningTasks: props.cleaningTasks, additionalRequirements: props.additionalRequirements, additionalCompletions: props.additionalCompletions, timezone: props.timezone, weekly: props.weekly, fourWeekly: props.fourWeekly });
  return <section aria-label="Manager overview">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#727a74]">Today · {props.locationName}</p><h2 className="mt-1 text-lg font-semibold">Needs attention</h2></div><p className="text-xs text-[#727a74]">Updated {props.updatedAt}</p></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[
      ["Required checks outstanding", model.summary.checksOutstanding],
      ["Unresolved issues", model.summary.unresolvedIssues],
      ["Cleaning outstanding", model.summary.cleaningOutstanding],
      ["Manager reviews due", model.summary.reviewsDue],
    ].map(([label, count]) => <div key={String(label)} className="rounded-2xl border border-black/[0.07] bg-white p-3"><span className="block text-xs text-[#727a74]">{label}</span><b className="mt-1 block text-xl">{count}</b></div>)}</div>
    <div className="mt-4 space-y-2">{model.actions.map(action => {
      const presentation = action.status === "overdue" || action.status === "open"
        ? { label: action.status === "open" ? "Open issue" : "Overdue", style: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]", icon: XCircle }
        : action.status === "monitoring" || action.status === "in_progress"
          ? { label: action.status === "monitoring" ? "Monitoring" : "In progress", style: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle }
          : { label: "Due now", style: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: Clock3 };
      const Icon = presentation.icon;
      return <article key={action.id} className="flex flex-col gap-3 rounded-2xl border border-black/[0.07] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{action.title}</h3><span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + presentation.style}><Icon className="size-3.5" aria-hidden="true" />{presentation.label}</span></div><p className="mt-1 text-sm text-[#606861]">{action.detail}</p>{action.actor && <p className="mt-1 text-xs text-[#727a74]">Latest staff attribution: {action.actor}</p>}</div><Button variant="outline" className="min-h-11 w-full shrink-0 sm:w-auto" onClick={() => action.issueId ? props.onIssue(action.issueId) : action.target?.kind === "review" ? props.onReview(action.target.reviewType) : action.target && props.onTask(action.target)}>{action.kind === "issue" ? "Review issue" : action.kind === "review" ? "Open review" : "Continue"}<ChevronRight className="ml-2 size-4" /></Button></article>;
    })}
    {!model.actions.length && <p className="rounded-2xl border border-[#cfe3d5] bg-white p-4 text-sm font-semibold text-[#216c45]"><CheckCircle2 className="mr-2 inline size-4" />No outstanding actions for this store.</p>}</div>
    {!!model.dueLater.length && <section className="mt-4 rounded-2xl border border-black/[0.07] bg-[#f7f8f6] p-4"><h3 className="font-semibold">Due later today</h3><ul className="mt-2 space-y-2 text-sm text-[#606861]">{model.dueLater.map(item => <li key={item.id} className="flex items-center justify-between gap-2"><span>{item.label}</span><span className="text-xs">Pending today</span></li>)}</ul></section>}
    {!!props.documents?.length && <section className="mt-4 rounded-2xl border border-black/[0.07] bg-white p-4"><h3 className="font-semibold">Training acknowledgements</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{props.documents.map(doc => <div key={doc.id} className="rounded-xl border border-black/[0.07] p-3"><div className="flex justify-between gap-3"><span className="font-medium">{doc.title} · v{doc.version}</span><b className="text-sm">{doc.acknowledgement.completionPercentage}%</b></div><p className="mt-1 text-xs text-[#606861]">{doc.acknowledgement.overdue ? "Overdue acknowledgements" : "Acknowledgement progress"}{doc.acknowledgement.deadline ? " · deadline " + new Date(doc.acknowledgement.deadline).toLocaleDateString("en-GB") : ""}</p></div>)}</div></section>}
  </section>;
}

