import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useState } from "react";

type Props = { editor: any; onClose: () => void; onSave: (data: any) => Promise<void> };
export default function ConfigEditor({ editor, onClose, onSave }: Props) {
  const [name, setName] = useState(editor.item?.name ?? editor.item?.question ?? "");
  const [question, setQuestion] = useState(editor.item?.question ?? "");
  const [frequency, setFrequency] = useState(editor.item?.frequency ?? "daily");
  const [weekdays, setWeekdays] = useState((editor.item?.weekdays ?? []).join(","));
  const [minimum, setMinimum] = useState(String(editor.item?.minimumTemperature ?? 76));
  const [hold, setHold] = useState(String(editor.item?.holdMinutes ?? 2));
  const [session, setSession] = useState(editor.session ?? editor.item?.session ?? "AM");
  const isQuestion = editor.kind === "question";
  const isSecurity = editor.kind === "security";
  const isCleaning = editor.kind === "cleaning";
  const isProduct = editor.kind === "product";
  const title = editor.item ? `Edit ${editor.kind}` : `Add ${editor.kind}`;
  async function save() { await onSave({ name: (isQuestion || isSecurity) ? question.trim() : name.trim(), question: (isQuestion || isSecurity) ? question.trim() : undefined, frequency, weekdays: frequency === "specific_days" ? weekdays.split(",").map(Number).filter(Boolean) : [], minimumTemperature: Number(minimum) || 76, holdMinutes: Number(hold) || 2, session }); }
  const valid = (isQuestion || isSecurity) ? question.trim() : name.trim();
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Admin setup</p><h2 className="mt-2 text-2xl font-semibold">{title}</h2></div><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></div><div className="mt-7 space-y-4">{isQuestion || isSecurity ? <><label className="block text-sm font-semibold">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] p-3" placeholder="Enter the question" /></label>{isSecurity && <label className="block text-sm font-semibold">Session<select value={session} onChange={(event) => setSession(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="AM">AM Security</option><option value="PM">PM Security</option></select></label>}</> : <label className="block text-sm font-semibold">Name<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11" placeholder={isCleaning ? "Clean food preparation surfaces" : isProduct ? "Sausages" : "Wastage item"} /></label>}{isCleaning && <><label className="block text-sm font-semibold">Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="after_use">After Use</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="specific_days">Specific days</option></select></label>{frequency === "specific_days" && <label className="block text-sm font-semibold">Days<Input value={weekdays} onChange={(event) => setWeekdays(event.target.value)} className="mt-2 h-11" placeholder="1,3,5 (Monday=1)" /></label>}</>}{isProduct && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Minimum °C<Input type="number" value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Hold minutes<Input type="number" value={hold} onChange={(event) => setHold(event.target.value)} className="mt-2 h-11" /></label></div>}</div><Button disabled={!valid} className="mt-7 h-12 w-full bg-[#f4c542] font-semibold text-[#171717]" onClick={save}>Save</Button></div></div>;
}
