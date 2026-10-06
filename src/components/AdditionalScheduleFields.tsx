import { Input } from "@/components/ui/input";
import { WEEKDAYS } from "@/shared/additional-scheduling";

type Props = {
  frequency: string;
  interval: string;
  weekdays: number[];
  dayOfMonth: string;
  nextDue: string;
  onFrequencyChange: (value: string) => void;
  onIntervalChange: (value: string) => void;
  onWeekdaysChange: (value: number[]) => void;
  onDayOfMonthChange: (value: string) => void;
  onNextDueChange: (value: string) => void;
};

export default function AdditionalScheduleFields({ frequency, interval, weekdays, dayOfMonth, nextDue, onFrequencyChange, onIntervalChange, onWeekdaysChange, onDayOfMonthChange, onNextDueChange }: Props) {
  const dayFrequencies = frequency === "monthly" || frequency === "every_x_months";
  const weekdayFrequencies = frequency === "weekly" || frequency === "every_x_weeks";
  return <div className="space-y-4">
    <label className="block text-sm font-semibold">Frequency<select value={frequency} onChange={event => onFrequencyChange(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="every_x_weeks">Every X weeks</option><option value="every_x_months">Every X months</option><option value="annual">Annual</option><option value="one_off">One-off</option></select></label>
    {(frequency === "every_x_weeks" || frequency === "every_x_months") && <label className="block text-sm font-semibold">Every <Input type="number" min="1" step="1" value={interval} onChange={event => onIntervalChange(event.target.value)} className="mt-2 h-12" /> <span className="mt-1 block text-xs font-normal text-[#89918b]">{frequency === "every_x_weeks" ? "weeks" : "months"}</span></label>}
    {weekdayFrequencies && <fieldset><legend className="text-sm font-semibold">Runs on</legend><div className="mt-2 flex gap-2" role="group" aria-label="Runs on weekdays">{WEEKDAYS.map(day => { const selected = weekdays.includes(day.value); return <button type="button" key={day.value} aria-pressed={selected} aria-label={day.label} onClick={() => onWeekdaysChange(selected ? weekdays.filter(value => value !== day.value) : [...weekdays, day.value].sort((a, b) => a - b))} className={`flex size-10 items-center justify-center rounded-full border text-sm font-semibold transition ${selected ? "border-[#202522] bg-[#ffde56] text-[#171717]" : "border-black/[0.12] bg-white text-[#68716a]"}`}>{day.short}</button>; })}</div><p className="mt-2 text-xs font-normal text-[#89918b]">Selected days: {weekdays.length ? weekdays.map(value => WEEKDAYS.find(day => day.value === value)?.label).join(", ") : "Choose at least one"}</p></fieldset>}
    {dayFrequencies && <label className="block text-sm font-semibold">Day of month<Input type="number" min="1" max="31" step="1" value={dayOfMonth} onChange={event => onDayOfMonthChange(event.target.value)} className="mt-2 h-12" /></label>}
    <label className="block text-sm font-semibold">{frequency === "annual" || frequency === "one_off" ? "Due date" : "First due date"}<Input type="date" value={nextDue} onChange={event => onNextDueChange(event.target.value)} className="mt-2 h-12" /></label>
  </div>;
}
