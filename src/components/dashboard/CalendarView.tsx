import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/date-key";
import { Top } from "@/components/dashboard/DashboardPrimitives";
import type { CalendarDay } from "@/components/dashboard/dashboard-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { calendarStatusLabel } from "@/lib/store-operational-day";

type Props = {
  month: Date;
  setMonth: Dispatch<SetStateAction<Date>>;
  days: CalendarDay[];
  onBack: () => void;
  onDay: (date: string) => void;
};

export default function CalendarView({ month, setMonth, days, onBack, onDay }: Props) {
  const dayMap = new Map(days.map(day => [day.date, day]));
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
  return <div className="min-h-screen bg-white"><Top title="Compliance calendar" onBack={onBack} /><main className="mx-auto max-w-4xl px-3 py-6 sm:px-8 sm:py-8"><div className="flex items-center justify-between gap-2"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button><h1 className="text-center text-xl font-semibold sm:text-2xl">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h1><Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button></div><div className="mt-6 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[#89918b] sm:mt-8 sm:gap-2 sm:text-xs sm:tracking-widest">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}{cells.map(date => { const key = formatDateKey(date); const item = dayMap.get(key); const inMonth = date.getMonth() === month.getMonth(); const status = item ? calendarStatusLabel(item.status) : "No recorded status"; const incomplete = item?.status === "red"; const tone = item?.status === "green" ? "bg-[#52a878]" : item?.status === "amber" ? "bg-[#d4a72c]" : incomplete ? "bg-[#c85a4b]" : "bg-[#c5cac6]"; return <button key={key} disabled={!inMonth} onClick={() => onDay(key)} aria-label={`${key}: ${status}${inMonth ? ". Open daily record" : ""}`} title={inMonth ? `${key}: ${status}. Open daily record` : undefined} className={`min-h-16 rounded-lg border p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow sm:min-h-20 sm:rounded-xl sm:p-2 ${!inMonth ? "border-transparent text-[#c5cac6]" : incomplete ? "border-[#c85a4b]/50 bg-[#fff8f6]" : item?.status === "amber" ? "border-[#d4a72c]/50 bg-[#fffaf0]" : "border-black/[0.07] bg-white"}`}><span className="font-semibold">{date.getDate()}</span>{item && <span className="mt-2 flex items-center gap-1.5 sm:mt-3"><span aria-hidden="true" className={`block size-2 shrink-0 rounded-full ${tone}`} /><span className={`hidden text-[9px] leading-tight sm:inline ${incomplete ? "font-semibold text-[#a13d32]" : "text-[#727a74]"}`}>{incomplete ? "Incomplete" : item.status === "green" ? "Complete" : item.status === "amber" ? "Action" : "Future"}</span></span>}</button>; })}</div><div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-[#606861] sm:flex sm:flex-wrap sm:gap-x-5"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#52a878]" />Complete</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#d4a72c]" />Corrective action recorded</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#c85a4b]" />Incomplete scheduled work — open date to review its original records</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#c5cac6]" />Future or non-operating date</span></div></main></div>;
}
