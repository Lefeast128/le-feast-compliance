import { CLEANING_WEEKDAYS } from "@/shared/cleaning-scheduling";

type Props = {
  frequency: string;
  weekdays: number[];
  onWeekdaysChange: (value: number[]) => void;
};

export default function CleaningScheduleFields({ frequency, weekdays, onWeekdaysChange }: Props) {
  if (frequency !== "weekly" && frequency !== "specific_days") return null;
  return <fieldset>
    <legend className="text-sm font-semibold">Scheduled weekdays</legend>
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Cleaning scheduled weekdays">
      {CLEANING_WEEKDAYS.map(day => {
        const selected = weekdays.includes(day.value);
        return <button type="button" key={day.value} aria-pressed={selected} aria-label={day.label} onClick={() => onWeekdaysChange(selected ? weekdays.filter(value => value !== day.value) : [...weekdays, day.value].sort((a, b) => a - b))} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${selected ? "border-[#202522] bg-brand-yellow text-[#171717]" : "border-black/[0.12] bg-white text-[#68716a]"}`}>{day.short}</button>;
      })}
    </div>
    <p className="mt-2 text-xs font-normal text-[#89918b]">Selected days: {weekdays.length ? weekdays.map(value => CLEANING_WEEKDAYS.find(day => day.value === value)?.label).join(", ") : "Choose at least one"}</p>
  </fieldset>;
}
