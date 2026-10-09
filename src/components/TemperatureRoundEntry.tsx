import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import TemperatureGauge from "@/components/TemperatureGauge";
import type { Equipment, TeamMember, TemperatureReading } from "@/components/dashboard/dashboard-types";
import type { Dispatch, SetStateAction } from "react";
import { ActiveStaffControl } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";

type Props = {
  session: "AM" | "PM";
  equipment: Equipment[];
  teamMembers: TeamMember[];
  memberId: string | null;
  setMemberId: (value: string) => void;
  temperatures: Record<string, string>;
  savedReadings?: TemperatureReading[];
  setTemperatures: Dispatch<SetStateAction<Record<string, string>>>;
  submitting: boolean;
  onComplete: (teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

export default function TemperatureRoundEntry({ session, equipment, teamMembers, memberId, setMemberId, temperatures, savedReadings = [], setTemperatures, submitting, onComplete, onBack }: Props) {
  const outOfRange = equipment.some(item => {
    const value = temperatures[item._id];
    if (!value) return false;
    const numeric = Number(value);
    const minimum = item.minimumTemperature ?? 0;
    const maximum = item.maximumTemperature ?? 8;
    return numeric < minimum || numeric > maximum;
  });
  const setReading = (id: string, value: string) => setTemperatures(current => ({ ...current, [id]: value }));
  const enteredCount = Object.values(temperatures).filter(Boolean).length;
  const hasValidMember = Boolean(memberId && teamMembers.some(member => member._id === memberId));

  return <div className="min-h-screen bg-[#fffdf4]"><OperationalHeader title={`${session} fridge temperatures`} eyebrow="Daily checks" date={operationalDateLabel()} subtitle="Record every configured fridge reading." progress={{ complete: enteredCount, total: equipment.length, label: "entered" }} onBack={onBack} /><main className="mx-auto max-w-2xl px-5 py-8"><h1 className="text-3xl font-semibold">Enter all fridge readings</h1><p className="mt-2 text-sm text-[#727a74]">Readings outside the configured acceptable range require an action.</p><div className="mt-8 space-y-3">{equipment.map((item, index) => { const value = temperatures[item._id] ?? ""; const numeric = value === "" ? 0 : Number(value); const minimum = item.minimumTemperature ?? 0; const maximum = item.maximumTemperature ?? 8; const failed = value !== "" && (numeric < minimum || numeric > maximum); const saved = savedReadings.find(reading => reading.equipmentId === item._id); return <div key={item._id} className={`rounded-2xl border bg-white p-5 ${failed ? "border-[#efc8c3]" : saved ? "border-[#cfe3d5]" : "border-black/[0.08]"}`}><div className="flex items-center justify-between gap-3"><div><p className="text-lg font-semibold">{item.name ?? item.type ?? `Fridge ${index + 1}`}</p><p className="text-xs text-[#89918b]">Acceptable range {minimum}°C–{maximum}°C</p></div><span className={`text-right text-xs font-semibold ${failed ? "text-[#b64738]" : saved ? "text-[#2d7951]" : "text-[#89918b]"}`}>{failed ? "Action required" : saved ? `Recorded · ${saved.teamMemberName ?? "Team member"}` : value ? "Entered" : "Required"}</span></div><TemperatureGauge value={value} setValue={next => setReading(item._id, next)} min={-25} max={15} safeMin={minimum} safeMax={maximum} disabled={Boolean(saved)} />{saved && <p className="mt-3 text-xs text-[#727a74]">Original reading saved{saved.createdAt ? ` · ${new Date(saved.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}. It will not be recorded again.</p>}{failed && <p className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-semibold text-[#b64738]">This reading requires corrective action before the round can be completed.</p>}</div>; })}</div>{outOfRange && <p className="mt-6 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-4 text-sm font-semibold text-[#8f3a31]">One or more readings require corrective action. Complete this check to continue.</p>}<p className="mt-5 text-center text-sm text-[#89918b]">{enteredCount} of {equipment.length} entered</p><div className="mt-5"><ActiveStaffControl teamMembers={teamMembers} value={hasValidMember ? memberId ?? "" : ""} onChange={setMemberId} label="Completing temperatures as" /></div><Button disabled={submitting || enteredCount !== equipment.length || !hasValidMember} className="mt-5 h-14 w-full bg-brand-yellow text-lg font-semibold text-[#171717]" onClick={() => onComplete(memberId!)}>Complete {session} check <Check className="ml-2 size-5" /></Button></main></div>;
}
