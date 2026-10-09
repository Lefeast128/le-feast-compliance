import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/date-key";
import { Top } from "@/components/dashboard/DashboardPrimitives";
import type { CalendarDay } from "@/components/dashboard/dashboard-types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

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
  return <div className="min-h-screen bg-white"><Top title="Compliance calendar" onBack={onBack} /><main className="mx-auto max-w-4xl px-5 py-8 sm:px-8"><div className="flex items-center justify-between"><Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></Button><h1 className="text-2xl font-semibold">{month.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</h1><Button variant="outline" size="icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></Button></div><div className="mt-8 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-widest text-[#89918b]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => <span key={day}>{day}</span>)}{cells.map(date => { const key = formatDateKey(date); const item = dayMap.get(key); const inMonth = date.getMonth() === month.getMonth(); return <button key={key} disabled={!inMonth} onClick={() => onDay(key)} className={`min-h-20 rounded-xl border p-2 text-left ${!inMonth ? "border-transparent text-[#c5cac6]" : "border-black/[0.07] bg-white"}`}><span className="font-semibold">{date.getDate()}</span>{item && <span className={`mt-3 block h-2 w-2 rounded-full ${item.status === "green" ? "bg-[#52a878]" : item.status === "amber" ? "bg-[#d4a72c]" : "bg-[#c85a4b]"}`} />}</button>; })}</div><p className="mt-7 text-sm text-[#727a74]">Green: complete · Amber: corrective action recorded · Red: unresolved issue or gap · Grey: future/non-operating date</p></main></div>;
}
