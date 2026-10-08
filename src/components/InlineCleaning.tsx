import { Button } from "@/components/ui/button";
import { Check, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { ActiveStaffControl, StaffAttributionLine } from "@/components/dashboard/StaffAttribution";

type CleaningTask = { _id: string; name: string; frequency?: string };
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
  async function complete(task: CleaningTask) {
    const memberId = selected[task._id] || activeMemberId;
    if (!memberId || saving) return;
    setSaving(task._id);
    try {
      await onComplete(task._id, memberId);
    } finally {
      setSaving(null);
    }
  }
  async function report(task: CleaningTask) {
    const memberId = selected[task._id] || activeMemberId;
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
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft />
          </Button>
          <div>
            <p className="font-semibold">Cleaning</p>
            <p className="text-xs text-[#89918b]">{locationName} · Today</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
          Daily checks
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Cleaning jobs</h1>
        <p className="mt-2 text-sm text-[#727a74]">
          Complete each cleaning job with the person who carried it out.
        </p>
        <div className="mt-6">
          <ActiveStaffControl teamMembers={teamMembers} value={activeMemberId} onChange={setActiveMemberId} />
        </div>
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
                className="rounded-2xl border border-black/[0.07] bg-white p-5"
              >
                <div>
                  <p className="font-semibold">{task.name}</p>
                  <p className="mt-1 text-xs text-[#89918b]">
                    {frequencyLabel}
                  </p>
                </div>
                {completion ? (
                  <div className="mt-4 text-sm font-semibold text-[#2d7951]">
                    <span className="flex items-center gap-1">
                      Completed <Check className="size-4" />
                    </span>
                    <span className="mt-1 block text-xs font-normal">
                      {completion.teamMemberName ?? "Not recorded"} ·{" "}
                      {timeLabel(completion.completedAt)}
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.6fr)]">
                    <StaffAttributionLine
                      value={selected[task._id] || activeMemberId}
                      teamMembers={teamMembers}
                      onChange={(value) => setSelected((current) => ({ ...current, [task._id]: value }))}
                      label={`Change person for ${task.name}`}
                      className="sm:col-span-2"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        aria-label="Mark complete"
                        disabled={!selected[task._id] || saving === task._id}
                        className="h-12 w-full bg-[#2d7951] text-white hover:bg-[#246442]"
                        onClick={() => void complete(task)}
                      >
                        <Check className="size-6" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!selected[task._id] || !onIssue}
                        className="h-12 w-full border-[#c9a94d] text-[#7b651a]"
                        onClick={() => setIssueTask(task._id)}
                      >
                        Issue
                      </Button>
                    </div>
                  </div>
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
