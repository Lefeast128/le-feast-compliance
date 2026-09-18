import { Button } from "@/components/ui/button";
import { Check, ChevronRight, ClipboardCheck, LockKeyhole, Package, Thermometer, Utensils, X } from "lucide-react";
import { ReactNode, useState } from "react";

type SectionKey = "opening" | "security" | "wastage" | "probes" | "temperature" | "closing";
type Props = {
  locationName: string;
  date: string;
  sections: Record<SectionKey, { status: string; detail: string }>;
  openingQuestions: any[];
  openingResponses: any[];
  closingQuestions: any[];
  closingResponses: any[];
  security: { AM: any[]; PM: any[] };
  securityResponses: { AM: any[]; PM: any[] };
  wastageItems: any[];
  wastageRecords: any[];
  probeProducts: any[];
  probeRecords: any[];
  equipment: any[];
  completedRounds: { AM: boolean; PM: boolean };
  onOpenChecklist: (kind: "opening" | "closing", index: number) => void;
  onOpenSecurity: (session: "AM" | "PM", index: number) => void;
  onOpenProbe: (product: string) => void;
  onOpenWastage: (itemId?: string) => void;
  onOpenRound: (session: "AM" | "PM") => void;
  overlay?: ReactNode;
};

const icons = { opening: ClipboardCheck, security: LockKeyhole, wastage: Package, probes: Utensils, temperature: Thermometer, closing: ClipboardCheck };

export default function DailyChecksHome(props: Props) {
  const [open, setOpen] = useState<SectionKey | null>(null);
  const allSections: SectionKey[] = ["opening", "security", "wastage", "probes", "temperature", "closing"];
  const current = open ? props.sections[open] : null;
  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]"><header className="sticky top-0 z-20 border-b border-black/[0.07] bg-[#f6f7f5]/95 backdrop-blur"><div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-8"><div><p className="text-[15px] font-semibold tracking-tight">Your Daily Checks</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Today</p></div><p className="text-sm text-[#727a74]">{props.locationName}</p></div></header><main className="mx-auto max-w-3xl px-4 py-8 sm:px-8"><div className="mb-8"><p className="text-sm font-medium text-[#7b827d]">{props.date}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em]">Daily Checks</h1><p className="mt-2 text-sm text-[#727a74]">Choose a section to see the jobs for this shift.</p></div>{open && current ? <SectionDetail section={open} {...props} onClose={() => setOpen(null)} /> : <div className="space-y-3">{allSections.map(section => <SectionRow key={section} section={section} status={props.sections[section]} onClick={() => setOpen(section)} />)}</div>}</main>{props.overlay}</div>;
}

function SectionRow({ section, status, onClick }: { section: SectionKey; status: { status: string; detail: string }; onClick: () => void }) { const Icon = icons[section]; const issue = status.status === "Issue"; const complete = status.status === "Complete"; return <button type="button" onClick={onClick} className={`flex w-full items-center gap-4 rounded-2xl border bg-white p-5 text-left transition-colors hover:border-[#c7a82e] ${issue ? "border-[#efc8c3]" : "border-black/[0.07]"}`}><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${issue ? "bg-[#fff0ed] text-[#b64738]" : complete ? "bg-[#e4f2e8] text-[#2d7951]" : "bg-[#fff7dc] text-[#8a6b12]"}`}>{complete ? <Check className="size-5" /> : <Icon className="size-5" />}</div><div className="min-w-0 flex-1"><p className="font-semibold">{labelFor(section)}</p><p className={`mt-1 text-sm ${issue ? "text-[#b64738]" : complete ? "text-[#2d7951]" : "text-[#727a74]"}`}>{status.status} · {status.detail}</p></div><ChevronRight className="size-5 text-[#89918b]" /></button>; }

function SectionDetail({ section, onClose, ...props }: Props & { section: SectionKey; onClose: () => void }) { return <div><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Section</p><h2 className="mt-1 text-2xl font-semibold">{labelFor(section)}</h2></div><Button variant="ghost" onClick={onClose}><X className="mr-2 size-4" /> View all checks</Button></div>{section === "opening" && <QuestionJobs title="Opening Food Safety" questions={props.openingQuestions} responses={props.openingResponses} checklist="opening" onOpen={props.onOpenChecklist} />}{section === "closing" && <QuestionJobs title="Closing Food Safety" questions={props.closingQuestions} responses={props.closingResponses} checklist="closing" onOpen={props.onOpenChecklist} />}{section === "security" && <SecurityJobs security={props.security} responses={props.securityResponses} onOpen={props.onOpenSecurity} />}{section === "wastage" && <WastageJobs items={props.wastageItems} records={props.wastageRecords} onOpen={props.onOpenWastage} />}{section === "probes" && <ProbeJobs products={props.probeProducts} records={props.probeRecords} onOpen={props.onOpenProbe} />}{section === "temperature" && <TemperatureJobs equipment={props.equipment} completed={props.completedRounds} onOpen={props.onOpenRound} />}</div>; }

function JobRow({ title, status, onClick }: { title: string; status: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/[0.07] bg-white p-5 text-left hover:border-[#c7a82e]"><div><p className="font-semibold">{title}</p><p className={`mt-1 text-sm ${status === "Complete" ? "text-[#2d7951]" : status === "Issue" ? "text-[#b64738]" : "text-[#727a74]"}`}>{status}</p></div><ChevronRight className="size-5 text-[#89918b]" /></button>; }
function QuestionJobs({ title, questions, responses, checklist, onOpen }: any) { return <div className="space-y-3">{questions.map((question: any, index: number) => { const response = responses.find((item: any) => item.questionId === question._id); return <JobRow key={question._id} title={`${index + 1}. ${question.question}`} status={response ? response.answer === "no" ? "Issue" : "Complete" : "Not started"} onClick={() => onOpen(checklist, index)} />; })}</div>; }
function SecurityJobs({ security, responses, onOpen }: any) { return <div className="space-y-6">{(["AM", "PM"] as const).map(session => <div key={session}><p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{session} Security</p><div className="space-y-3">{security[session].map((question: any, index: number) => <JobRow key={question._id} title={question.question} status={responses[session].some((item: any) => item.questionId === question._id) ? "Complete" : "Not started"} onClick={() => onOpen(session, index)} />)}</div></div>)}</div>; }
function WastageJobs({ items, records, onOpen }: any) { return <div className="space-y-3"><JobRow title="No Waste" status={records.some((record: any) => record.noWaste) ? "Complete" : "Not started"} onClick={() => onOpen()} />{items.map((item: any) => <JobRow key={item._id} title={item.name} status={records.some((record: any) => record.itemId === item._id) ? "Complete" : "Not started"} onClick={() => onOpen(item._id)} />)}</div>; }
function ProbeJobs({ products, records, onOpen }: any) { return <div className="space-y-3">{products.map((product: any) => { const record = records.find((item: any) => item.product === product.name); return <JobRow key={product._id} title={product.name} status={record ? record.result === "fail" ? "Issue" : "Complete" : "Not started"} onClick={() => onOpen(product.name)} />; })}</div>; }
function TemperatureJobs({ equipment, completed, onOpen }: any) { return <div className="space-y-3"><JobRow title={`AM temperatures · ${equipment.length} fridges`} status={completed.AM ? "Complete" : "Not started"} onClick={() => onOpen("AM")} /><JobRow title={`PM temperatures · ${equipment.length} fridges`} status={completed.PM ? "Complete" : "Not started"} onClick={() => onOpen("PM")} /></div>; }
function labelFor(section: SectionKey) { return ({ opening: "Opening Food Safety", security: "Security", wastage: "Wastage", probes: "Probe Checks", temperature: "Fridge Temperatures", closing: "Closing Food Safety" })[section]; }
