import { Button } from "@/components/ui/button";
import { Check, TriangleAlert } from "lucide-react";
import { StaffAttributionLine } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";
import type { Dispatch, SetStateAction } from "react";
import type { Equipment, TeamMember } from "@/components/dashboard/dashboard-types";

type IssueProgress = {
  action: string;
  note: string;
  actionMemberId: string;
  actionsSaved: boolean;
};

type Props = {
  session: "AM" | "PM";
  issues: Array<Equipment & { issueId: string; temperature: number }>;
  teamMembers: TeamMember[];
  issueProgress: Record<string, IssueProgress>;
  setIssueProgress: Dispatch<SetStateAction<Record<string, IssueProgress>>>;
  roundCompleterId: string | null;
  setRoundCompleterId: (value: string) => void;
  submitting: boolean;
  onSaveActions: (issueId: string, action: string, note: string, teamMemberId: string) => Promise<void>;
  onCompleteRound: (teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

const options = ["Fridge door checked", "Fridge settings checked", "Food moved to another fridge", "Food removed from sale", "Food discarded", "Manager informed", "Fridge taken out of use", "Maintenance reported", "Other"];
const emptyProgress: IssueProgress = { action: "", note: "", actionMemberId: "", actionsSaved: false };

export default function TemperatureActionScreen({ session, issues, teamMembers, issueProgress, setIssueProgress, roundCompleterId, setRoundCompleterId, submitting, onSaveActions, onCompleteRound, onBack }: Props) {
  const allActionsSaved = issues.length > 0 && issues.every((issue) => issueProgress[issue.issueId]?.actionsSaved);
  return <div className="min-h-screen bg-[#fff8f6]">
    <OperationalHeader title="Corrective action" eyebrow={`${session} fridge temperatures`} date={operationalDateLabel()} subtitle="Record what happened for each failed fridge." onBack={onBack} />
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b64738]">{session} fridge temperatures</p>
      <h1 className="mt-3 text-3xl font-semibold">Record what happened for each fridge</h1>
      <div className="mt-6 space-y-5">
        {issues.map((issue) => {
          const progress = issueProgress[issue.issueId] ?? emptyProgress;
          const update = (patch: Partial<IssueProgress>) => setIssueProgress((current: Record<string, IssueProgress>) => ({ ...current, [issue.issueId]: { ...emptyProgress, ...current[issue.issueId], ...patch } }));
          return <div key={issue.issueId} className="rounded-2xl border border-[#efc8c3] bg-white p-5">
            <p className="font-semibold">{issue.name}</p>
            <p className="mt-1 text-4xl font-semibold text-[#b64738]">{issue.temperature}°C</p>
            <p className="mt-1 text-sm text-[#8f3a31]">Outside the configured range of {issue.minimumTemperature ?? 0}°C to {issue.maximumTemperature ?? 8}°C</p>
            <p className="mt-6 font-semibold">Corrective action</p>
            <select disabled={progress.actionsSaved} value={progress.action} onChange={(event) => update({ action: event.target.value })} className="mt-3 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select corrective action</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            <label className="mt-4 block text-sm font-semibold">Reason / notes<textarea disabled={progress.actionsSaved} value={progress.note} onChange={(event) => update({ note: event.target.value })} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] bg-white p-3" placeholder="Add context if useful" /></label>
            <div className="mt-4"><StaffAttributionLine value={progress.actionMemberId} teamMembers={teamMembers} onChange={(value) => update({ actionMemberId: value })} label={`Change person for ${issue.name}`} /></div>
            {!progress.actionsSaved ? <Button aria-label="Mark complete" disabled={!progress.action || !progress.actionMemberId || (progress.action === "Other" && !progress.note.trim())} className="mt-6 h-14 w-full bg-[#2d7951] text-white" onClick={() => onSaveActions(issue.issueId, progress.action, progress.note, progress.actionMemberId)}><Check className="mr-2 size-5" /> Mark complete</Button> : <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#b9dfc5] bg-[#f3fbf5] p-5 text-[#2d7951]"><Check className="size-5" /><div><p className="font-semibold">Issue reported</p><p className="text-sm">Corrective action recorded. Further rechecks and resolution are managed in Issues &amp; Reviews.</p></div></div>}
            {!progress.actionsSaved && <p className="mt-3 flex items-center gap-2 text-xs text-[#727a74]"><TriangleAlert className="size-4" /> The temperature reading remains failed until the issue is resolved.</p>}
          </div>;
        })}
      </div>
      {allActionsSaved && <div className="mt-6 rounded-2xl border border-black/[0.08] bg-white p-4"><p className="font-semibold">All corrective actions recorded</p><p className="mt-1 text-sm text-[#727a74]">Choose who is completing this temperature round. Rechecks and resolution remain in Issues &amp; Reviews.</p><div className="mt-3"><StaffAttributionLine value={roundCompleterId ?? ""} teamMembers={teamMembers} onChange={setRoundCompleterId} label="Temperature round completed by" /></div><Button disabled={!roundCompleterId || submitting} className="mt-4 h-12 w-full bg-[#2d7951] text-white" onClick={() => void onCompleteRound(roundCompleterId!)}>{submitting ? "Completing…" : "Complete temperature round"}</Button></div>}
    </main>
  </div>;
}
