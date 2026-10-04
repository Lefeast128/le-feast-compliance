import { Button } from "@/components/ui/button";
import type { DashboardLocation } from "@/components/dashboard/dashboard-types";
import { ArrowLeft, CalendarDays, Check, ChevronRight, ClipboardCheck, Coffee, LogOut, Moon, RotateCcw, ShieldCheck, Sun, Thermometer, X } from "lucide-react";
import type { Dispatch, ReactNode, SetStateAction } from "react";

export function Brand() {
  return <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ffde56] text-[#171717]"><Coffee className="size-5" /></div><div className="min-w-0"><p className="truncate text-[13px] font-semibold tracking-tight sm:text-[15px]">Your Daily Checks</p><p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74] sm:block">Internal compliance workspace</p></div></div>;
}

export function Top({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button><p className="font-semibold">{title}</p></div></header>;
}

export function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold">{title}</h2></div><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></div><div className="mt-7">{children}</div></div></div>;
}

export function Choice({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-2xl border p-5 text-left text-lg font-semibold ${active ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.08] bg-white"}`}>{active ? "✓ " : "○ "}{label}</button>;
}

export function Section({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return <section className={className}><h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#68716a]">{title}</h2>{children}</section>;
}

export function EntryCard({ title, status, complete, action, onClick }: { title: string; status: string; complete: boolean; action: string; onClick: () => void }) {
  const lowerTitle = title.toLowerCase();
  const isMorning = lowerTitle.includes("opening") || lowerTitle.includes("am security");
  const isEvening = lowerTitle.includes("closing") || lowerTitle.includes("pm security");
  const StatusIcon = isMorning ? Sun : isEvening ? Moon : Thermometer;
  return <div className={`rounded-2xl border p-5 sm:p-6 ${complete ? "border-[#cfe3d5] bg-[#fbfefb]" : "border-black/[0.07] bg-white"}`}><div className="flex items-start gap-4"><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${complete ? "bg-[#e4f2e8] text-[#2d7951]" : "bg-[#fff7dc] text-[#8a6b12]"}`}>{complete ? <Check className="size-5" /> : <StatusIcon className="size-5" />}</div><div><p className="text-lg font-semibold">{title}</p><p className={`mt-1 text-sm ${complete ? "text-[#2d7951]" : "text-[#727a74]"}`}>{status}</p></div></div><Button className={`mt-5 h-12 w-full font-semibold ${complete ? "bg-white text-[#202522] ring-1 ring-black/[0.1] hover:bg-[#f6f7f5]" : "bg-[#ffde56] text-[#171717] hover:bg-[#f7d363]"}`} onClick={onClick}>{complete ? "View readings" : action}<ChevronRight className="ml-2 size-4" /></Button></div>;
}

export function Header({ locations, locationId, onLocationChange, onAdmin, onCalendar, onTraining, onLogout }: { locations: DashboardLocation[]; locationId: string | null; onLocationChange: (locationId: string) => void; onAdmin: () => void; onCalendar: () => void; onTraining: () => void; onLogout: () => void | Promise<void> }) {
  return <header className="sticky top-0 z-20 border-b border-black/[0.07] bg-[#f6f7f5]/95 backdrop-blur"><div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:px-8" style={{ display: "block" }}><div className="order-1 flex w-full min-w-0 items-center justify-between" style={{ display: "flex", width: "100%" }}><Brand /><div className="flex shrink-0 items-center gap-0.5 sm:gap-1"><Button variant="ghost" size="sm" className="gap-2 px-2 sm:px-3" onClick={onCalendar}><CalendarDays className="size-4" /><span className="hidden sm:inline">Calendar</span></Button><Button variant="ghost" size="sm" className="gap-2 px-2 sm:px-3" onClick={onTraining}><ClipboardCheck className="size-4" /><span className="hidden sm:inline">Training</span></Button><Button variant="ghost" size="sm" className="gap-2 px-2 sm:px-3" onClick={onAdmin}><ShieldCheck className="size-4" /><span className="hidden sm:inline">Admin</span></Button><Button variant="ghost" size="icon" className="shrink-0" onClick={onLogout}><LogOut className="size-4" /></Button></div></div>{locations.length > 0 && <label className="order-2 flex w-full items-center gap-2" style={{ display: "flex", width: "100%", marginTop: "0.75rem" }}><span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-[#89918b]">Store</span><select value={locationId ?? locations[0]?._id ?? ""} onChange={(event) => onLocationChange(event.target.value)} className="h-10 min-w-0 w-full rounded-xl border border-black/[0.1] bg-white px-2 text-sm font-semibold text-[#202522] outline-none focus:ring-2 focus:ring-[#ffde56] sm:w-52 sm:px-3">{locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}</select></label>}</div></header>;
}

export function TemperatureInput({ value, setValue, min, max, safeMin, safeMax }: { value: string; setValue: Dispatch<SetStateAction<string>>; min: number; max: number; safeMin: number; safeMax: number }) {
  const hasValue = value !== "";
  const numeric = hasValue ? Number(value) : NaN;
  const outOfRange = hasValue && (numeric < safeMin || numeric > safeMax);
  const update = (next: string) => { if (next === "") { setValue(""); return; } const parsed = Number(next); if (!Number.isNaN(parsed)) setValue(next); };
  const scrollTo = (next: number) => setValue(Math.max(min, Math.min(max, Math.round(next * 10) / 10)).toFixed(1));
  const position = hasValue && !Number.isNaN(numeric) ? Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100)) : 0;
  const safeStart = Math.max(0, Math.min(100, ((safeMin - min) / (max - min)) * 100));
  const safeWidth = Math.max(4, Math.min(100 - safeStart, ((safeMax - safeMin) / (max - min)) * 100));
  return <div className="mt-3 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_4px_16px_rgba(23,25,24,0.04)]"><div className="flex items-start justify-between gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-[#e2f5e8] text-[#27814f]" aria-hidden="true"><Thermometer className="size-5" strokeWidth={2.25} /></div><div className="flex items-center gap-2"><label className="sr-only">Temperature in degrees Celsius</label><input aria-label="Temperature in degrees Celsius" inputMode="decimal" type="number" min={min} max={max} step="0.1" value={value} onChange={event => update(event.target.value)} onBlur={() => { if (hasValue && !Number.isNaN(numeric)) setValue(Math.max(min, Math.min(max, numeric)).toFixed(1)); }} placeholder="—" className={`h-12 w-24 border-0 bg-transparent px-0 text-right text-4xl font-semibold tracking-tight outline-none focus:ring-0 ${outOfRange ? "text-[#b64738]" : "text-[#202522]"}`} /><span className="text-lg font-semibold text-[#727a74]">°C</span><Button type="button" variant="ghost" size="icon" className="size-11 rounded-full border border-black/[0.08]" onClick={() => setValue("")} aria-label="Clear temperature"><RotateCcw className="size-4" /></Button></div></div><div className="mt-7"><div className="relative h-3 rounded-full bg-[#e7e9e5]"><div className={`absolute inset-y-0 rounded-full ${outOfRange ? "bg-[#e5a39a]" : "bg-[#f4c542]"}`} style={{ left: `${safeStart}%`, width: `${safeWidth}%` }} /><span className={`pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${outOfRange ? "bg-[#b64738]" : "bg-[#202522]"}`} style={{ left: `${position}%` }} /><input aria-label="Scroll to choose temperature" type="range" min={min} max={max} step="0.1" value={hasValue && !Number.isNaN(numeric) ? numeric : safeMin} onChange={event => scrollTo(Number(event.target.value))} className="absolute inset-0 h-3 w-full cursor-pointer opacity-0" /></div></div><div className="mt-4 flex items-center justify-between gap-3"><span className={`rounded-full px-4 py-2 text-xs font-semibold ${outOfRange ? "bg-[#fff0ed] text-[#b64738]" : hasValue ? "bg-[#e2f5e8] text-[#27814f]" : "bg-[#f1f2ef] text-[#727a74]"}`}>{outOfRange ? "OUT OF RANGE" : hasValue ? "SAFE" : "SCROLL TO ENTER"}</span></div><div className="mt-2 flex justify-between text-xs text-[#89918b]"><span>{min}°</span><span>Safe {safeMin}°–{safeMax}°</span><span>{max}°</span></div></div>;
}
