import { Button } from "@/components/ui/button";
import { DailyTaskCard } from "@/components/dashboard/DailyTaskCard";
import type { DailyTaskModel } from "@/components/dashboard/daily-checks-model";
import { CheckCircle2, ChevronRight, Plus, AlertTriangle } from "lucide-react";
import type { DashboardIssue, ManagerReviewStatus } from "@/components/dashboard/dashboard-types";

const reviewStatusLabel = (period: ManagerReviewStatus["periods"]["weekly"]) =>
  period.status === "complete"
    ? "Complete"
    : period.status === "overdue"
      ? "Overdue"
      : period.daysUntilDue > 0
        ? `Due in ${period.daysUntilDue} days`
        : "Due";

const reviewTone = (period: ManagerReviewStatus["periods"]["weekly"]) =>
  period.status === "complete" ? "text-[#2d7951]" : period.status === "overdue" ? "text-[#a13f34]" : "text-[#8a6b12]";

export function DailyChecksJourney({
  locationName,
  todayLabel,
  currentUserName,
  completed,
  total,
  progressPercent,
  progressMessage,
  tasks,
  onTaskAction,
  canUseManagement,
  managerReviewStatus,
  onManagerReviews,
  openIssues,
  onIssueSelected,
  onReportIssue,
}: {
  locationName: string;
  todayLabel: string;
  currentUserName: string;
  completed: number;
  total: number;
  progressPercent: number;
  progressMessage: string;
  tasks: DailyTaskModel[];
  onTaskAction: (task: DailyTaskModel) => void;
  canUseManagement: boolean;
  managerReviewStatus?: ManagerReviewStatus | null;
  onManagerReviews: () => void;
  openIssues: DashboardIssue[];
  onIssueSelected: (issue: DashboardIssue) => void;
  onReportIssue: () => void;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <div className="mb-7 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div>
          <p className="text-sm font-medium text-[#7b827d]">{todayLabel}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.05em]">{locationName}</h1>
          <p className="mt-2 text-sm text-[#727a74]">{currentUserName}</p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-2 text-xs font-semibold text-[#727a74] shadow-[0_3px_12px_rgba(23,25,24,0.04)]">Daily compliance journey</span>
      </div>

      <section className="rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_6px_22px_rgba(23,25,24,0.05)] sm:p-7" aria-labelledby="todays-checks-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Today&apos;s checks</p>
            <h2 id="todays-checks-heading" className="mt-2 text-2xl font-semibold tracking-tight">{completed} of {total} complete</h2>
            <p className="mt-2 text-sm text-[#727a74]">{progressMessage}</p>
          </div>
          <span className="text-3xl font-semibold tracking-tight text-[#202522]">{progressPercent}%</span>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef0ec]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} aria-label="Today's checks progress">
          <div className="h-full rounded-full bg-[#ffde56] transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      {canUseManagement && (
        <section className="mt-5 rounded-2xl border border-[#ead797] bg-[#fffdf4] p-4 sm:p-5" aria-label="Manager reviews">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Manager reviews</p>
              <div className="mt-2 grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-6">
                <p>Weekly review <span className={`ml-2 font-semibold ${managerReviewStatus ? reviewTone(managerReviewStatus.periods.weekly) : "text-[#727a74]"}`}>{managerReviewStatus ? reviewStatusLabel(managerReviewStatus.periods.weekly) : "Loading…"}</span></p>
                <p>4-week review <span className={`ml-2 font-semibold ${managerReviewStatus ? reviewTone(managerReviewStatus.periods.four_weekly) : "text-[#727a74]"}`}>{managerReviewStatus ? reviewStatusLabel(managerReviewStatus.periods.four_weekly) : "Loading…"}</span></p>
              </div>
            </div>
            <Button variant="outline" onClick={onManagerReviews}>Open reviews <ChevronRight className="ml-2 size-4" /></Button>
          </div>
        </section>
      )}

      <section className="mt-8" aria-labelledby="daily-journey-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Daily journey</p>
            <h2 id="daily-journey-heading" className="mt-1 text-xl font-semibold">Your next checks</h2>
          </div>
          <span className="text-xs font-semibold text-[#89918b]">Tap any step to continue</span>
        </div>
        <ol className="relative space-y-3 before:absolute before:bottom-8 before:left-[1.35rem] before:top-8 before:w-px before:bg-[#dfe3dd] sm:space-y-4">
          {tasks.map((task, index) => (
            <DailyTaskCard key={task.id} task={task} step={index + 1} onAction={() => onTaskAction(task)} />
          ))}
        </ol>
      </section>

      <section className="mt-8" aria-labelledby="issues-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Attention area</p>
            <h2 id="issues-heading" className="mt-1 text-xl font-semibold">Issues & corrective actions</h2>
          </div>
        </div>
        <div className={`rounded-3xl border p-5 sm:p-6 ${openIssues.length ? "border-[#efc8c3] bg-[#fff8f6]" : "border-[#cfe3d5] bg-[#fbfefb]"}`}>
          {openIssues.length ? (
            <>
              <p className="flex items-center gap-2 text-lg font-semibold text-[#8f3a31]"><AlertTriangle className="size-5" /> {openIssues.length} action{openIssues.length === 1 ? "" : "s"} required</p>
              <div className="mt-4 space-y-3">
                {openIssues.slice(0, 3).map((issue) => (
                  <button type="button" key={issue._id} className="w-full rounded-2xl bg-white p-4 text-left shadow-[0_3px_12px_rgba(23,25,24,0.04)]" onClick={() => onIssueSelected(issue)}>
                    <p className="font-semibold">{issue.title}</p>
                    <p className="mt-1 text-sm text-[#727a74]">{issue.description}</p>
                    {issue.action && <p className="mt-2 text-xs text-[#8f3a31]">{issue.action}</p>}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="flex items-center gap-2 font-semibold text-[#2d7951]"><CheckCircle2 className="size-5" /> No unresolved issues</p>
          )}
          <Button variant={openIssues.length ? "outline" : "default"} className={`mt-5 ${openIssues.length ? "" : "bg-[#202522] text-white"}`} onClick={onReportIssue}>
            <Plus className="mr-2 size-4" /> Report an issue
          </Button>
        </div>
      </section>
    </main>
  );
}
