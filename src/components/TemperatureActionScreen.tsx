import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight } from "lucide-react";

type IssueProgress = {
  actions: string[];
  actionMemberId: string;
  actionsSaved: boolean;
  recheckTemperature: string;
  recheckMemberId: string;
  recheckSaved: boolean;
};

type Props = {
  session: "AM" | "PM";
  issues: any[];
  teamMembers: any[];
  issueProgress: Record<string, IssueProgress>;
  setIssueProgress: (value: any) => void;
  onSaveActions: (issueId: any, actions: string[], teamMemberId: any) => Promise<void>;
  onRecheck: (issueId: any, temperature: string, teamMemberId: any) => Promise<void>;
  onBack: () => void;
};

const options = ["Rechecked temperature", "Fridge door checked", "Fridge settings checked", "Food moved to another fridge", "Food removed from sale", "Food discarded", "Manager informed", "Fridge taken out of use", "Maintenance reported"];
const emptyProgress: IssueProgress = { actions: [], actionMemberId: "", actionsSaved: false, recheckTemperature: "", recheckMemberId: "", recheckSaved: false };

export default function TemperatureActionScreen({ session, issues, teamMembers, issueProgress, setIssueProgress, onSaveActions, onRecheck, onBack }: Props) {
  return <div className="min-h-screen bg-[#fff8f6]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack}>←</Button><p className="font-semibold">Action required</p></div></header>
    <main className="mx-auto max-w-2xl px-5 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b64738]">{session} fridge temperatures</p>
      <h1 className="mt-3 text-3xl font-semibold">Record what happened for each fridge</h1>
      <div className="mt-6 space-y-5">
        {issues.map((issue: any) => {
          const progress = issueProgress[issue.issueId] ?? emptyProgress;
          const update = (patch: Partial<IssueProgress>) => setIssueProgress((current: Record<string, IssueProgress>) => ({ ...current, [issue.issueId]: { ...emptyProgress, ...current[issue.issueId], ...patch } }));
          return <div key={issue.issueId} className="rounded-2xl border border-[#efc8c3] bg-white p-5">
            <p className="font-semibold">{issue.name}</p>
            <p className="mt-1 text-4xl font-semibold text-[#b64738]">{issue.temperature}°C</p>
            <p className="mt-1 text-sm text-[#8f3a31]">Above the configured maximum</p>
            <p className="mt-6 font-semibold">Corrective action for this fridge</p>
            <div className="mt-3 grid gap-2">{options.map((option) => <button type="button" key={option} disabled={progress.actionsSaved} onClick={() => update({ actions: progress.actions.includes(option) ? progress.actions.filter((item) => item !== option) : [...progress.actions, option] })} className={"rounded-xl border p-4 text-left text-sm " + (progress.actions.includes(option) ? "border-[#b64738] bg-[#b64738] text-white" : "border-black/[0.08] bg-white")}>{progress.actions.includes(option) ? "✓ " : "□ "}{option}</button>)}</div>
            <label className="mt-6 block text-sm font-semibold">Action recorded by<select disabled={progress.actionsSaved} value={progress.actionMemberId} onChange={(event) => update({ actionMemberId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select team member</option>{teamMembers.map((item: any) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
            {!progress.actionsSaved ? <Button disabled={!progress.actions.length || !progress.actionMemberId} className="mt-6 h-14 w-full bg-[#202522] text-white" onClick={() => onSaveActions(issue.issueId, progress.actions, progress.actionMemberId)}>Save this fridge's actions <ChevronRight className="ml-2 size-4" /></Button> : <div className="mt-6 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-5">
              <p className="font-semibold text-[#8f3a31]">RECHECK THIS FRIDGE</p>
              <p className="mt-1 text-sm text-[#727a74]">Record a new reading after the action.</p>
              <div className="mt-3 flex items-center gap-3"><Input disabled={progress.recheckSaved} type="number" inputMode="decimal" step="0.1" value={progress.recheckTemperature} onChange={(event) => update({ recheckTemperature: event.target.value })} placeholder="4.8" className="h-14 text-2xl font-semibold" /><span className="font-semibold">°C</span></div>
              <label className="mt-4 block text-sm font-semibold">Recheck completed by<select disabled={progress.recheckSaved} value={progress.recheckMemberId} onChange={(event) => update({ recheckMemberId: event.target.value })} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select team member</option>{teamMembers.map((item: any) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              <Button disabled={progress.recheckSaved || !progress.recheckTemperature || !progress.recheckMemberId} className="mt-4 h-14 w-full bg-[#ffde56] font-semibold text-[#171717]" onClick={() => onRecheck(issue.issueId, progress.recheckTemperature, progress.recheckMemberId)}>{progress.recheckSaved ? "Recheck recorded" : "Record this fridge's recheck"} <Check className="ml-2 size-4" /></Button>
            </div>}
          </div>;
        })}
      </div>
    </main>
  </div>;
}
