import { Button } from "@/components/ui/button";
import { adjustedTemperature, clampTemperature } from "@/lib/temperature-gauge";
import { Minus, Plus, RotateCcw, Thermometer } from "lucide-react";

type Props = { value: string; setValue: (value: string) => void; min: number; max: number; safeMin: number; safeMax: number; disabled?: boolean };
export default function TemperatureGauge({ value, setValue, min, max, safeMin, safeMax, disabled = false }: Props) {
  const hasValue = value !== "";
  const numeric = hasValue ? Number(value) : NaN;
  const outOfRange = hasValue && (numeric < safeMin || numeric > safeMax);
  const update = (next: string) => {
    if (next === "") {
      setValue("");
      return;
    }
    if (!Number.isNaN(Number(next))) setValue(next);
  };
  const adjust = (delta: number) => setValue(adjustedTemperature(value, delta, safeMin, min, max));
  const scrollTo = (next: number) => setValue(clampTemperature(next, min, max).toFixed(1));
  const position = hasValue && !Number.isNaN(numeric) ? Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100)) : 0;
  const safeStart = Math.max(0, Math.min(100, ((safeMin - min) / (max - min)) * 100));
  const safeWidth = Math.max(4, Math.min(100 - safeStart, ((safeMax - safeMin) / (max - min)) * 100));

  return <div className="mt-3 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_4px_16px_rgba(23,25,24,0.04)]">
    <div className="flex items-start justify-between gap-3">
      <div className="flex size-10 items-center justify-center rounded-full bg-[#e2f5e8] text-[#27814f]" aria-hidden="true"><Thermometer className="size-5" strokeWidth={2.25} /></div>
      <div className="flex items-center gap-2">
        <label className="sr-only">Temperature in degrees Celsius</label>
        <input disabled={disabled} aria-label="Temperature in degrees Celsius" inputMode="decimal" type="number" min={min} max={max} step="0.1" value={value} onChange={(event) => update(event.target.value)} onBlur={() => { if (hasValue && !Number.isNaN(numeric)) setValue(clampTemperature(numeric, min, max).toFixed(1)); }} placeholder="—" className={`h-12 w-24 border-0 bg-transparent px-0 text-right text-4xl font-semibold tracking-tight outline-none focus:ring-0 ${outOfRange ? "text-[#b64738]" : "text-[#202522]"}`} />
        <span className="text-lg font-semibold text-[#727a74]">°C</span>
        <Button disabled={disabled} type="button" variant="ghost" size="icon" className="size-11 rounded-full border border-black/[0.08]" onClick={() => setValue("")} aria-label="Clear temperature"><RotateCcw className="size-4" /></Button>
      </div>
    </div>
    <div className="mt-7 flex items-center gap-3">
      <Button disabled={disabled} type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full border border-black/[0.1]" onClick={() => adjust(-0.1)} aria-label="Decrease temperature"><Minus className="size-5" /></Button>
      <div className="relative h-3 flex-1 rounded-full bg-[#e7e9e5]"><div className={`absolute inset-y-0 rounded-full ${outOfRange ? "bg-[#e5a39a]" : "bg-brand-yellow"}`} style={{ left: `${safeStart}%`, width: `${safeWidth}%` }} /><span className={`pointer-events-none absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${outOfRange ? "bg-[#b64738]" : "bg-[#202522]"}`} style={{ left: `${position}%` }} /><input disabled={disabled} aria-label="Choose temperature" type="range" min={min} max={max} step="0.1" value={hasValue && !Number.isNaN(numeric) ? numeric : safeMin} onChange={(event) => scrollTo(Number(event.target.value))} className="absolute inset-0 h-3 w-full cursor-pointer opacity-0" /></div>
      <Button disabled={disabled} type="button" variant="ghost" size="icon" className="size-11 shrink-0 rounded-full border border-black/[0.1]" onClick={() => adjust(0.1)} aria-label="Increase temperature"><Plus className="size-5" /></Button>
    </div>
    <div className="mt-4 flex items-center justify-between gap-3"><span className={`rounded-full px-4 py-2 text-xs font-semibold ${outOfRange ? "bg-[#fff0ed] text-[#b64738]" : hasValue ? "bg-[#e2f5e8] text-[#27814f]" : "bg-[#f1f2ef] text-[#727a74]"}`}>{outOfRange ? "OUT OF RANGE" : hasValue ? "SAFE" : "READY"}</span></div>
    <div className="mt-2 flex justify-between text-xs text-[#89918b]"><span>{min}°</span><span>Safe {safeMin}°–{safeMax}°</span><span>{max}°</span></div>
  </div>;
}
