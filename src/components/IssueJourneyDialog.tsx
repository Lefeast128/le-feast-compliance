import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { issueStatusLabel, resultLabel } from "@/lib/temperature-resolution";

type JourneyEvent = {
  eventType: string;
  occurredAt: string | null;
  title: string;
  detail: string;
  result?: string | null;
  teamMemberName?: string | null;
};

type Issue = {
  id: string;
  title: string;
  category: string;
  status: string;
  resolvedAt?: string | null;
  teamMemberName?: string | null;
  journey?: JourneyEvent[];
};

type Props = {
  issue: Issue;
  timeZone: string;
  onClose: () => void;
};

const timeLabel = (value: string | null | undefined, timeZone: string) => {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export default function IssueJourneyDialog({ issue, timeZone, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Issue journey</p>
            <h2 className="mt-2 text-2xl font-semibold">{issue.title}</h2>
            <p className="mt-1 text-sm text-[#727a74]">{issue.category} · {issueStatusLabel(issue.status)}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close issue journey"><X /></Button>
        </div>
        <div className="mt-6 rounded-2xl bg-[#fafbf9] p-4 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#89918b]">Current issue status</p>
          <p className="mt-1 font-semibold">{issueStatusLabel(issue.status)}</p>
          <p className="mt-2 text-xs text-[#727a74]">Issue recorded by {issue.teamMemberName ?? "Not recorded"}</p>
        </div>
        <div className="mt-7">
          <h3 className="font-semibold">Original failure and corrective action</h3>
          <div className="mt-3 space-y-3">
            {(issue.journey ?? []).map((event, index) => (
              <div key={`${event.eventType}-${event.occurredAt}-${index}`} className="rounded-xl border border-black/[0.07] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{event.title}</p>
                    <p className="mt-1 text-sm text-[#727a74]">{event.detail}</p>
                  </div>
                  {event.result && <span className="shrink-0 text-sm font-semibold">{resultLabel(event.result)}</span>}
                </div>
                <p className="mt-2 text-xs text-[#89918b]">{event.teamMemberName ?? "Not recorded"} · {timeLabel(event.occurredAt, timeZone)}</p>
              </div>
            ))}
            {!issue.journey?.length && <p className="text-sm text-[#89918b]">No issue journey events recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
