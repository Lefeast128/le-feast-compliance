import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import TemperatureGauge from "@/components/TemperatureGauge";
import type { Equipment, TeamMember } from "@/components/dashboard/dashboard-types";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

type Props = {
  session: "AM" | "PM";
  equipment: Equipment[];
  teamMembers: TeamMember[];
  temperatures: Record<string, string>;
  setTemperatures: Dispatch<SetStateAction<Record<string, string>>>;
  submitting: boolean;
  onComplete: (teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

export default function TemperatureRoundEntry({ session, equipment, teamMembers, temperatures, setTemperatures, submitting, onComplete, onBack }: Props) {
  const [member, setMember] = useState("");
  const outOfRange = equipment.some(item => {
    const value = temperatures[item._id];
    if (!value) return false;
    const numeric = Number(value);
    const minimum = item.minimumTemperature ?? 0;
    const maximum = item.maximumTemperature ?? 8;
    return numeric < minimum || numeric > maximum;
  });
  const setReading = (id: string, value: string) => setTemperatures(current => ({ ...current, [id]: value }));

  return <div className="min-h-screen bg-[#fffdf4]"><header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button><p className="font-semibold">{session} fridge temperatures</p></div></header><main className="mx-auto max-w-2xl px-5 py-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#997813]">{session} fridge temperatures</p><h1 className="mt-3 text-3xl font-semibold">Enter all fridge readings</h1><p className="mt-2 text-sm text-[#727a74]">Readings outside the configured acceptable range require an action.</p><div className="mt-8 space-y-3">{equipment.map((item, index) => { const value = temperatures[item._id] ?? ""; const numeric = value === "" ? 0 : Number(value); const minimum = item.minimumTemperature ?? 0; const maximum = item.maximumTemperature ?? 8; const failed = value !== "" && (numeric < minimum || numeric > maximum); return <div key={item._id} className={`rounded-2xl border bg-white p-5 ${failed ? "border-[#efc8c3]" : "border-black/[0.08]"}`}><div className="flex items-center justify-between"><div><p className="text-lg font-semibold">Fridge {index + 1}</p><p className="text-xs text-[#89918b]">Acceptable range {minimum}°C–{maximum}°C</p></div><span className={`text-xs font-semibold ${failed ? "text-[#b64738]" : "text-[#89918b]"}`}>{failed ? "Action required" : value ? "Entered" : "Required"}</span></div><TemperatureGauge value={value} setValue={next => setReading(item._id, next)} min={-25} max={15} safeMin={minimum} safeMax={maximum} />{failed && <p className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-semibold text-[#b64738]">This reading requires corrective action before the round can be completed.</p>}</div>; })}</div>{outOfRange && <p className="mt-6 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-4 text-sm font-semibold text-[#8f3a31]">One or more readings require corrective action. Complete this check to continue.</p>}<p className="mt-5 text-center text-sm text-[#89918b]">{Object.values(temperatures).filter(Boolean).length} of {equipment.length} entered</p><label className="mt-5 block text-sm font-semibold">Completed by<select value={member} onChange={event => setMember(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select team member</option>{teamMembers.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><Button disabled={submitting || Object.values(temperatures).filter(Boolean).length !== equipment.length || !member} className="mt-5 h-14 w-full bg-[#ffde56] text-lg font-semibold text-[#171717]" onClick={() => onComplete(member)}>Complete {session} check <Check className="ml-2 size-5" /></Button></main></div>;
}
