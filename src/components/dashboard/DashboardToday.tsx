import IssueDetail from "@/components/IssueDetail";
import TaskIssueModal from "@/components/TaskIssueModal";
import StaffWastageModal from "@/components/WastageModal";
import { Button } from "@/components/ui/button";
import { EntryCard, Header, Section } from "@/components/dashboard/DashboardPrimitives";
import { ProbeModal } from "@/components/dashboard/DashboardWorkflowScreens";
import type { DashboardData, DashboardIssue, DashboardLocation, DashboardView, Equipment, TemperatureRound } from "@/components/dashboard/dashboard-types";
import { buildWastagePayload, type WastagePickerProduct } from "@/lib/wastage-picker";
import type { Dispatch, SetStateAction } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";

const timeLabel = (value: number) => new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export type DashboardTodayProps = {
  dashboard: DashboardData;
  active: DashboardData;
  locations?: DashboardLocation[];
  locationId: string | null;
  onLocationChange: (locationId: string) => void;
  onAdmin: () => void;
  onCalendar: () => void;
  onTraining: () => void;
  onLogout: () => void | Promise<void>;
  todayLabel: string;
  renderTimestamp: number;
  requiredComplete: number;
  equipment: Equipment[];
  memberName: (id?: string) => string;
  amRound?: TemperatureRound;
  pmRound?: TemperatureRound;
  amComplete: boolean;
  pmComplete: boolean;
  openingComplete: boolean;
  closingComplete: boolean;
  amSecurityComplete: boolean;
  pmSecurityComplete: boolean;
  openIssues: DashboardIssue[];
  beginRound: (session: "AM" | "PM") => void | Promise<void>;
  viewTodayRecords: () => void;
  setView: Dispatch<SetStateAction<DashboardView>>;
  additional?: { requirements: unknown[]; completions: unknown[] };
  setCleaningList: Dispatch<SetStateAction<boolean>>;
  setChecklistList: Dispatch<SetStateAction<"opening" | "closing" | null>>;
  beginSecurity: (session: "AM" | "PM") => void;
  setProbeProduct: Dispatch<SetStateAction<string>>;
  setProbeFailed: Dispatch<SetStateAction<boolean>>;
  setProbeIssueId: Dispatch<SetStateAction<string | null>>;
  setProbeQuantity: Dispatch<SetStateAction<string>>;
  setProbeOpen: Dispatch<SetStateAction<boolean>>;
  probeOpen: boolean;
  probeProduct: string;
  probeQuantity: string;
  probeTemperature: string;
  setProbeTemperature: Dispatch<SetStateAction<string>>;
  probeFailed: boolean;
  saveProbe: (teamMemberId: string) => Promise<void>;
  issueOpen: boolean;
  setIssueOpen: Dispatch<SetStateAction<boolean>>;
  saveIssue: (description: string, teamMemberId: string) => Promise<void>;
  wastageOpen: boolean;
  openWastage: () => void;
  setWastageOpen: Dispatch<SetStateAction<boolean>>;
  wastageCatalogue: WastagePickerProduct[];
  wastageCatalogueLoading: boolean;
  wastageCatalogueError: string | null;
  saveWastage: (payload: ReturnType<typeof buildWastagePayload>) => Promise<void>;
  issueSelected: DashboardIssue | null;
  setIssueSelected: Dispatch<SetStateAction<DashboardIssue | null>>;
  addIssueUpdate: (args: Record<string, unknown>) => Promise<unknown>;
};

export default function DashboardToday({ dashboard, active, locations, locationId, onLocationChange, onAdmin, onCalendar, onTraining, onLogout, todayLabel, renderTimestamp, requiredComplete, equipment, memberName, amRound, pmRound, amComplete, pmComplete, openingComplete, closingComplete, amSecurityComplete, pmSecurityComplete, openIssues, beginRound, viewTodayRecords, setView, additional, setCleaningList, setChecklistList, beginSecurity, setProbeProduct, setProbeFailed, setProbeIssueId, setProbeQuantity, setProbeOpen, probeOpen, probeProduct, probeQuantity, probeTemperature, setProbeTemperature, probeFailed, saveProbe, issueOpen, setIssueOpen, saveIssue, wastageOpen, openWastage, setWastageOpen, wastageCatalogue, wastageCatalogueLoading, wastageCatalogueError, saveWastage, issueSelected, setIssueSelected, addIssueUpdate }: DashboardTodayProps) {
  return <div className="min-h-screen overflow-x-hidden bg-[#f6f7f5] text-[#171918]"><Header locations={locations?.length ? locations : dashboard ? [dashboard.location] : []} locationId={dashboard?.location._id ?? locationId} onLocationChange={onLocationChange} onAdmin={onAdmin} onCalendar={onCalendar} onTraining={onTraining} onLogout={onLogout} /><main className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-10"><div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-sm font-medium text-[#7b827d]">{todayLabel}</p><h1 className="text-3xl font-semibold tracking-[-0.05em]">{dashboard?.location.name ?? "Your store"}</h1></div><div className="rounded-2xl border border-black/[0.07] bg-white px-5 py-4"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#89918b]">Today</p><p className="mt-1 text-2xl font-semibold tracking-tight">{requiredComplete} <span className="text-base text-[#89918b]">of 6 required checks complete</span></p></div></div><div className="flex flex-col gap-7"><Section title="Fridge temperatures"><div className="grid gap-4 md:grid-cols-2"><EntryCard title="AM temperatures" status={amComplete ? `✓ Complete · ${equipment.length} recorded · ${memberName(amRound?.teamMemberId)} · ${timeLabel(amRound?.completedAt ?? amRound?.startedAt ?? renderTimestamp)}` : `${equipment.length ? 0 : 0} of ${equipment.length || 4} fridges recorded`} complete={amComplete} action="Enter AM temperatures" onClick={() => amComplete ? viewTodayRecords() : beginRound("AM")} /><EntryCard title="PM temperatures" status={pmComplete ? `✓ Complete · ${equipment.length} recorded · ${memberName(pmRound?.teamMemberId)} · ${timeLabel(pmRound?.completedAt ?? pmRound?.startedAt ?? renderTimestamp)}` : "Due later today"} complete={pmComplete} action="Enter PM temperatures" onClick={() => pmComplete ? viewTodayRecords() : beginRound("PM")} /></div></Section><Section title="Food probes"><div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-lg font-semibold">Cooking temperatures</p><p className="mt-1 text-sm text-[#727a74]">{dashboard?.foodChecks.length ?? 0} recorded today · standard 76°C / 2 minutes</p></div><Button className="h-12 bg-[#ffde56] font-semibold text-[#171717] hover:bg-[#ffde56]" onClick={() => { setProbeProduct(active?.probeProducts[0]?.name ?? ""); setProbeFailed(false); setProbeIssueId(null); setProbeQuantity(""); setProbeOpen(true); }}><Plus className="mr-2 size-4" /> Record food probe</Button></div>{dashboard?.foodChecks.length ? <div className="mt-5 grid gap-2 border-t border-black/[0.07] pt-4 sm:grid-cols-2">{dashboard.foodChecks.slice(-4).reverse().map(checkItem => <div key={checkItem._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-4 py-3"><div><p className="text-sm font-semibold">{checkItem.product}</p><p className="text-xs text-[#89918b]">Quantity: {checkItem.quantity ?? "Not recorded"} · {checkItem.teamMemberName ?? "Team member"} · {timeLabel(checkItem.createdAt)}</p></div><span className={checkItem.result === "pass" ? "font-semibold text-[#2d7951]" : "font-semibold text-[#b64738]"}>{checkItem.temperature}°C {checkItem.result === "pass" ? "✓" : "!"}</span></div>)}</div> : null}</div></Section><Section title="Wastage" className="order-5"><div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-lg font-semibold">Wastage record</p><p className="mt-1 text-sm text-[#727a74]">{dashboard?.wastageRecords.length ?? 0} records today</p></div><Button className="h-12 bg-[#ffde56] font-semibold text-[#171717] hover:bg-[#ffde56]" onClick={openWastage}><Plus className="mr-2 size-4" /> Record wastage</Button></div>{dashboard?.wastageRecords.length ? <div className="mt-5 space-y-2 border-t border-black/[0.07] pt-4">{dashboard.wastageRecords.slice(-3).reverse().map(record => <div key={record._id} className="flex justify-between rounded-xl bg-[#fafbf9] px-4 py-3 text-sm"><span className="font-semibold">{record.noWaste ? "No Waste" : record.itemName}<span className="block text-xs font-normal text-[#89918b]">{record.teamMemberName ?? "Team member"} · {timeLabel(record.createdAt)}</span></span><span className="text-[#727a74]">{record.noWaste ? "—" : record.quantity}</span></div>)}</div> : null}</div></Section><Section title="Cleaning"><div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-lg font-semibold">Cleaning jobs</p><p className="mt-1 text-sm text-[#727a74]">{active?.cleaningCompletions.length ?? 0} of {active?.cleaningTasks.length ?? 0} due today complete</p></div><Button className="h-12 bg-[#ffde56] font-semibold text-[#171717]" onClick={() => setCleaningList(true)}>Open cleaning jobs <ChevronRight className="ml-2 size-4" /></Button></div></div></Section><Section title="Additional checks">{additional?.requirements?.length ? <div className="rounded-2xl border border-[#f0d98a] bg-[#fffdf4] p-5"><div className="flex items-center justify-between gap-4"><div><p className="text-lg font-semibold">{additional.requirements.length} task{additional.requirements.length === 1 ? "" : "s"} due</p><p className="mt-1 text-sm text-[#727a74]">Weekly, monthly or recurring compliance checks</p></div><Button className="h-12 bg-[#ffde56] font-semibold text-[#171717]" onClick={() => setView("additional")}>Open additional checks <ChevronRight className="ml-2 size-4" /></Button></div></div> : null}</Section><Section title="Checklist"><div className="grid gap-4 md:grid-cols-2"><EntryCard title="Opening checklist" status={openingComplete ? `✓ Complete · ${active?.checklistSignOffs?.find((signOff) => signOff.checklist === "opening")?.teamMemberName ?? "Team member"} · ${timeLabel(active?.checklistSignOffs?.find((signOff) => signOff.checklist === "opening")?.completedAt ?? renderTimestamp)}` : "Not completed"} complete={openingComplete} action="Complete opening checklist" onClick={() => openingComplete ? viewTodayRecords() : setChecklistList("opening")} /><EntryCard title="Closing checklist" status={closingComplete ? `✓ Complete · ${active?.checklistSignOffs?.find((signOff) => signOff.checklist === "closing")?.teamMemberName ?? "Team member"} · ${timeLabel(active?.checklistSignOffs?.find((signOff) => signOff.checklist === "closing")?.completedAt ?? renderTimestamp)}` : "Due later today"} complete={closingComplete} action="Complete closing checklist" onClick={() => closingComplete ? viewTodayRecords() : setChecklistList("closing")} /></div></Section><Section title="Security"><div className="grid gap-4 md:grid-cols-2"><EntryCard title="AM Security Check" status={amSecurityComplete ? `✓ Complete · ${active?.securitySignOffs?.find((signOff) => signOff.session === "AM")?.teamMemberName ?? "Team member"} · ${timeLabel(active?.securitySignOffs?.find((signOff) => signOff.session === "AM")?.completedAt ?? renderTimestamp)}` : "Not completed"} complete={amSecurityComplete} action="Complete AM security" onClick={() => amSecurityComplete ? viewTodayRecords() : beginSecurity("AM")} /><EntryCard title="PM Security Check" status={pmSecurityComplete ? `✓ Complete · ${active?.securitySignOffs?.find((signOff) => signOff.session === "PM")?.teamMemberName ?? "Team member"} · ${timeLabel(active?.securitySignOffs?.find((signOff) => signOff.session === "PM")?.completedAt ?? renderTimestamp)}` : "Due later today"} complete={pmSecurityComplete} action="Complete PM security" onClick={() => pmSecurityComplete ? viewTodayRecords() : beginSecurity("PM")} /></div></Section><Section title="Issues / corrective actions" className="order-6"><div className={`rounded-2xl border p-5 sm:p-6 ${openIssues.length ? "border-[#efc8c3] bg-[#fff8f6]" : "border-black/[0.07] bg-white"}`}><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div>{openIssues.length ? <><p className="flex items-center gap-2 text-lg font-semibold text-[#8f3a31]"><AlertTriangle className="size-5" /> {openIssues.length} action required</p><div className="mt-4 space-y-3">{openIssues.slice(0, 3).map(issue => <button type="button" key={issue._id} className="w-full rounded-xl bg-white p-4 text-left" onClick={() => setIssueSelected(issue)}>
<p className="font-semibold">{issue.title}</p><p className="mt-1 text-sm text-[#727a74]">{issue.description}</p>{issue.action && <p className="mt-2 text-xs text-[#8f3a31]">{issue.action}</p>}</button>)}</div></> : <p className="flex items-center gap-2 font-semibold text-[#2d7951]"><CheckCircle2 className="size-5" /> No unresolved food-safety issues</p>}</div><Button variant={openIssues.length ? "outline" : "default"} className={openIssues.length ? "" : "bg-[#202522] text-white"} onClick={() => setIssueOpen(true)}><Plus className="mr-2 size-4" /> Report an issue</Button></div></div></Section></div></main>{probeOpen && <ProbeModal products={active?.probeProducts ?? []} teamMembers={dashboard?.teamMembers ?? []} product={probeProduct} setProduct={setProbeProduct} quantity={probeQuantity} setQuantity={setProbeQuantity} temperature={probeTemperature} setTemperature={setProbeTemperature} failed={probeFailed} onSave={saveProbe} onClose={() => { setProbeOpen(false); setProbeFailed(false); setProbeIssueId(null); }} />}{issueOpen && <TaskIssueModal teamMembers={dashboard?.teamMembers ?? []} onClose={() => setIssueOpen(false)} onSave={saveIssue} />}{wastageOpen && <StaffWastageModal products={wastageCatalogue} teamMembers={dashboard?.teamMembers ?? []} loading={wastageCatalogueLoading} error={wastageCatalogueError} onSave={saveWastage} onClose={() => setWastageOpen(false)} />}{issueSelected && <IssueDetail issue={issueSelected} teamMembers={dashboard?.teamMembers ?? []} onUpdate={async (args: Record<string, unknown>) => { await addIssueUpdate(args); const refreshed = dashboard?.issues.find((item) => item._id === issueSelected._id); if (refreshed) setIssueSelected(refreshed); toast.success("Issue update saved"); }} onClose={() => setIssueSelected(null)} />}</div>;
}
