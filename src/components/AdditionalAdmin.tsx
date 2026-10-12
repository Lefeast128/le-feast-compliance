import AdditionalScheduleFields from "@/components/AdditionalScheduleFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restApi, useRestMutation, useRestQuery } from "@/lib/rest-domain";
import { WEEKDAYS } from "@/shared/additional-scheduling";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const fieldTypes = ["temperature", "number", "yes_no", "completed", "date", "text", "actions", "pdf"] as const;
type AdditionalField = { key: string; label: string; type: string; minimum?: number; maximum?: number; options?: string[] };
type AdditionalItem = { _id: string; title: string; description?: string | null; frequency: string; interval?: number | null; weekdays?: number[] | null; dayOfMonth?: number | null; nextDueAt: string | number; fields: AdditionalField[]; centralItemId?: string | null };
type Props = { locationId: string };

const dateInput = (value: string | number | Date) => new Date(value).toISOString().slice(0, 10);

export default function AdditionalAdmin({ locationId }: Props) {
  const items = useRestQuery<AdditionalItem[]>(`additional-admin:${locationId}`, () => restApi.additional.list({ locationId }), true) ?? [];
  const add = useRestMutation(restApi.additional.add);
  const update = useRestMutation(restApi.additional.update);
  const remove = useRestMutation(restApi.additional.remove);
  const reorder = useRestMutation(restApi.additional.reorder);
  const [editing, setEditing] = useState<AdditionalItem | true | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [interval, setInterval] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [nextDue, setNextDue] = useState("");
  const [fields, setFields] = useState<AdditionalField[]>([]);

  function open(item?: AdditionalItem) {
    const due = new Date(item?.nextDueAt ?? Date.now());
    const fallbackWeekday = due.getUTCDay() === 0 ? 7 : due.getUTCDay();
    setEditing(item ?? true);
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setFrequency(item?.frequency ?? "monthly");
    setInterval(String(item?.interval ?? 1));
    setWeekdays(item?.weekdays?.length ? item.weekdays : [fallbackWeekday]);
    setDayOfMonth(String(item?.dayOfMonth ?? due.getUTCDate()));
    setNextDue(dateInput(due));
    setFields(item?.fields ?? [{ key: "check", label: "Check", type: "yes_no" }]);
  }

  async function save() {
    if (!title.trim()) return;
    const payload = {
      title,
      description: description || undefined,
      frequency,
      interval: ["every_x_weeks", "every_x_months"].includes(frequency) ? Number(interval) : undefined,
      weekdays: ["weekly", "every_x_weeks"].includes(frequency) ? weekdays : undefined,
      dayOfMonth: ["monthly", "every_x_months"].includes(frequency) ? Number(dayOfMonth) : undefined,
      nextDueAt: new Date(`${nextDue || dateInput(Date.now())}T12:00:00`).getTime(),
      fields: fields.map(field => ({ ...field, key: field.key || field.label.toLowerCase().replace(/\W+/g, "_") })),
    };
    if (editing === true) await add({ locationId, ...payload });
    else if (editing) await update({ requirementId: editing._id, ...payload });
    setEditing(null);
    toast.success("Additional check saved");
  }

  const scheduleLabel = (item: AdditionalItem) => {
    const days = (item.weekdays ?? []).map(value => WEEKDAYS.find(day => day.value === value)?.short).filter(Boolean).join("");
    return `${item.frequency.replace(/_/g, " ")}${days ? ` · ${days}` : ""}`;
  };
  const invalidSchedule = !title.trim() || !nextDue || ((frequency === "weekly" || frequency === "every_x_weeks") && !weekdays.length) || (["every_x_weeks", "every_x_months"].includes(frequency) && (!interval.trim() || !Number.isInteger(Number(interval)) || Number(interval) < 1)) || (["monthly", "every_x_months"].includes(frequency) && (!dayOfMonth.trim() || !Number.isInteger(Number(dayOfMonth)) || Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31));

  return <section className="rounded-2xl border border-black/[0.07] bg-white p-5 lg:col-span-2">
    <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Additional Checks</h2><p className="mt-1 text-sm text-[#89918b]">Recurring weekly, monthly and one-off compliance tasks.</p></div><Button className="bg-[#202522] text-white" onClick={() => open()}><Plus className="mr-1 size-4" /> Add requirement</Button></div>
    <div className="mt-4 space-y-2">{items.map((item, index) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-xl bg-[#fafbf9] p-3 text-sm"><div><p className="font-semibold">{index + 1}. {item.title}{item.centralItemId && <span className="ml-2 rounded-full bg-[#e9f0e6] px-2 py-1 text-[10px] font-semibold text-[#477152]">Organisation standard</span>}</p><p className="text-xs text-[#89918b]">{scheduleLabel(item)} · Due {new Date(item.nextDueAt).toLocaleDateString("en-GB")} · {item.fields.length} field{item.fields.length === 1 ? "" : "s"}</p></div>{item.centralItemId ? <span className="text-xs font-semibold text-[#477152]">Organisation standard</span> : <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => reorder({ requirementId: item._id, direction: "up" })}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => reorder({ requirementId: item._id, direction: "down" })}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => open(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => remove({ requirementId: item._id })}><Trash2 className="size-4" /></Button></div>}</div>)}{!items.length && <p className="text-sm text-[#89918b]">No additional requirements configured.</p>}</div>
    {editing && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{editing === true ? "Add" : "Edit"} Additional Check</h2><Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X /></Button></div><div className="mt-6 space-y-4"><label className="block text-sm font-semibold">Title<Input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 h-12" placeholder="Probe recalibration" /></label><label className="block text-sm font-semibold">Description<textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" placeholder="Instructions for the person completing the check" /></label><AdditionalScheduleFields frequency={frequency} interval={interval} weekdays={weekdays} dayOfMonth={dayOfMonth} nextDue={nextDue} onFrequencyChange={setFrequency} onIntervalChange={setInterval} onWeekdaysChange={setWeekdays} onDayOfMonthChange={setDayOfMonth} onNextDueChange={setNextDue} /><div><div className="flex items-center justify-between"><p className="text-sm font-semibold">Required fields</p><Button size="sm" variant="outline" onClick={() => setFields(current => [...current, { key: `field_${current.length + 1}`, label: "New field", type: "text" }])}><Plus className="mr-1 size-4" /> Add field</Button></div><p className="mt-2 text-xs text-[#89918b]">For Red and Black probe temperatures, use numerical fields with an acceptable minimum and maximum. Add an action field when a reading is outside the range.</p><div className="mt-3 space-y-2">{fields.map((field, index) => <div key={index} className="space-y-2"><div className="flex gap-2"><Input value={field.label} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Field label" /><select value={field.type} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, type: event.target.value, minimum: event.target.value === "temperature" || event.target.value === "number" ? item.minimum : undefined, maximum: event.target.value === "temperature" || event.target.value === "number" ? item.maximum : undefined, options: event.target.value === "actions" ? item.options : undefined } : item))} className="h-10 rounded-xl border border-black/[0.1] bg-white px-2 text-sm">{fieldTypes.map(type => <option key={type} value={type}>{type.replace("_", " ")}</option>)}</select>{(field.type === "temperature" || field.type === "number") && <div className="min-w-28 space-y-1"><Input type="number" step={field.type === "temperature" ? "0.1" : "any"} value={field.minimum ?? ""} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, minimum: event.target.value === "" ? undefined : Number(event.target.value) } : item))} placeholder={field.type === "temperature" ? "Acceptable minimum" : "Minimum"} aria-label={field.type === "temperature" ? "Acceptable minimum" : "Minimum"} /><Input type="number" step={field.type === "temperature" ? "0.1" : "any"} value={field.maximum ?? ""} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, maximum: event.target.value === "" ? undefined : Number(event.target.value) } : item))} placeholder={field.type === "temperature" ? "Acceptable maximum" : "Maximum"} aria-label={field.type === "temperature" ? "Acceptable maximum" : "Maximum"} /></div>}<Button variant="ghost" size="icon" onClick={() => setFields(current => current.filter((_, i) => i !== index))}><Trash2 className="size-4 text-[#b64738]" /></Button></div>{field.type === "actions" && <label className="block text-sm font-semibold">Corrective action options<textarea value={(field.options ?? []).join("\n")} onChange={event => setFields(current => current.map((item, i) => i === index ? { ...item, options: event.target.value.split("\n").map(value => value.trim()).filter(Boolean) } : item))} className="min-h-20 w-full rounded-xl border border-black/[0.1] p-3" placeholder="One action per line" /></label>}</div>)}</div></div></div><Button disabled={invalidSchedule} className="mt-6 h-12 w-full bg-brand-yellow text-[#171717]" onClick={() => void save()}>Save requirement</Button></div></div>}
  </section>;
}
