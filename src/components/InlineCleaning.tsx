import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { ActiveStaffControl, StaffAttributionLine } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";
import { resolveCleaningMemberId } from "@/lib/cleaning-attribution";

type CleaningTask = {
  _id: string;
  name: string;
  description?: string | null;
  frequency?: string;
  taskType?: "simple" | "with_steps";
  completionMode?: "question" | "task";
};
type CleaningCompletion = {
  taskId: string;
  completedAt?: number | string;
  teamMemberName?: string | null;
};
type TeamMember = { _id: string; name: string };
type Props = {
  locationName: string;
  tasks: CleaningTask[];
  completions: CleaningCompletion[];
  teamMembers: TeamMember[];
  onComplete: (taskId: string, teamMemberId: string) => Promise<void>;
  onIssue?: (description: string, teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

const timeLabel = (value?: number | string) =>
  value === undefined
    ? ""
    : new Date(value).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

export default function InlineCleaning({
  locationName,
  tasks,
  completions,
  teamMembers,
  onComplete,
  onIssue,
  onBack,
}: Props) {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [activeMemberId, setActiveMemberId] = useState("");
  const [issueTask, setIssueTask] = useState<string | null>(null);
  const [issueText, setIssueText] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const completedCount = tasks.filter((task) => completions.some((item) => item.taskId === task._id)).length;
  const allComplete = tasks.length > 0 && completedCount === tasks.length;
  async function complete(task: CleaningTask) {
    const memberId = resolveCleaningMemberId(selected[task._id], activeMemberId);
    if (!memberId || saving) return;
    setSaving(task._id);
    try {
      await onComplete(task._id, memberId);
    } finally {
      setSaving(null);
    }
  }
  async function report(task: CleaningTask) {
    const memberId = resolveCleaningMemberId(selected[task._id], activeMemberId);
    if (!memberId || !issueText.trim() || !onIssue) return;
    setSaving(`issue:${task._id}`);
    try {
      await onIssue(`${task.name}: ${issueText.trim()}`, memberId);
      setIssueTask(null);
      setIssueText("");
    } finally {
      setSaving(null);
    }
  }
  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <OperationalHeader
        title="Cleaning jobs"
        eyebrow="Daily checks"
        date={operationalDateLabel()}
        subtitle={locationName}
        progress={{ complete: completedCount, total: tasks.length }}
        onBack={onBack}
      />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="mt-2 text-sm text-[#727a74]">Complete each cleaning job with the person who carried it out.</p>
        <div className="mt-6">
          <ActiveStaffControl teamMembers={teamMembers} value={activeMemberId} onChange={setActiveMemberId} />
        </div>
        {allComplete && <section className="mt-4 rounded-2xl border border-[#b9dfc5] bg-[#f3fbf5] p-4 text-[#2d7951]" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Cleaning complete</p>
              <p className="mt-1 text-sm">All scheduled cleaning jobs are recorded.</p>
              <Button type="button" variant="outline" className="mt-3 border-[#9bcaaa] text-[#2d7951]" onClick={onBack}>View all checks</Button>
            </div>
          </div>
        </section>}
        <div className="mt-7 space-y-2">
          {tasks.map((task) => {
            const completion = completions.find(
              (item) => item.taskId === task._id,
            );
            const frequencyLabel =
              task.frequency === "after_use"
                ? "After use"
                : task.frequency === "specific_days"
                  ? "Scheduled day"
                  : task.frequency
                    ? task.frequency[0].toUpperCase() + task.frequency.slice(1)
                    : "Scheduled";
            return (
              <div
                key={task._id}
                className={`rounded-2xl border bg-white p-4 shadow-[0_2px_10px_rgba(23,25,24,0.035)] ${completion ? "border-[#cfe3d5]" : "border-black/[0.07]"}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${completion ? "bg-[#eaf6ed] text-[#2d7951]" : "bg-[#f1f3ef] text-[#89918b]"}`} aria-hidden="true">
                    {completion ? <Check className="size-4" /> : <span className="size-2 rounded-full bg-current" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${completion ? "text-[#59625c]" : "text-[#202522]"}`}>{task.name}</p>
                    {task.description && <p className="mt-1 whitespace-pre-line text-sm leading-5 text-[#727a74]">{task.description}</p>}
                  </div>
                </div>
                <p className="mt-1 pl-11 text-xs text-[#89918b]">
                  {frequencyLabel}
                </p>
                {completion ? (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#cfe3d5] bg-[#f7fcf8] px-3 py-3 text-sm text-[#59625c]">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#2d7951]" />
                    <span>Completed by <strong className="text-[#303631]">{completion.teamMemberName ?? "Not recorded"}</strong>{timeLabel(completion.completedAt) && <span className="text-[#727a74]"> · {timeLabel(completion.completedAt)}</span>}</span>
                  </div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        aria-label={`Mark ${task.name} complete`}
                        disabled={!resolveCleaningMemberId(selected[task._id], activeMemberId) || saving === task._id}
                        className="h-12 w-full bg-[#2d7951] text-white hover:bg-[#246442]"
                        onClick={() => void complete(task)}
                      >
                        {saving === task._id ? <Loader2 className="mx-auto size-5 animate-spin" /> : <><Check className="mr-2 size-5" />Complete</>}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!resolveCleaningMemberId(selected[task._id], activeMemberId) || !onIssue}
                        className="h-12 w-full border-[#c9a94d] text-[#7b651a]"
                        onClick={() => setIssueTask(task._id)}
                      >
                        <AlertTriangle className="mr-1 size-4" />Issue
                      </Button>
                    </div>
                    <StaffAttributionLine
                      value={selected[task._id] || activeMemberId}
                      teamMembers={teamMembers}
                      onChange={(value) => setSelected((current) => ({ ...current, [task._id]: value }))}
                      label={`Change person for ${task.name}`}
                      className="mt-3"
                    />
                  </>
                )}
                {issueTask === task._id && (
                  <div className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4">
                    <p className="font-semibold text-[#8f3a31]">
                      What stopped this check being completed?
                    </p>
                    <textarea
                      value={issueText}
                      onChange={(event) => setIssueText(event.target.value)}
                      className="mt-3 min-h-24 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                      placeholder="Short explanation"
                    />
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIssueTask(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={
                          !issueText.trim() || saving === `issue:${task._id}`
                        }
                        className="bg-[#202522] text-white"
                        onClick={() => void report(task)}
                      >
                        Report issue
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {!tasks.length && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#727a74]">
              No cleaning jobs are due today.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
