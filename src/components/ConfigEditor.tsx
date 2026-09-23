import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useState } from "react";

type Props = { editor: any; onClose: () => void; onSave: (data: any) => Promise<void>; teamMembers?: any[] };

const trainingCategories = [
  ["northern_rail", "Northern Rail"],
  ["food_safety", "Food Safety"],
  ["security", "Security"],
  ["equipment", "Equipment"],
  ["alcohol", "Alcohol"],
  ["company_procedure", "Company Procedure"],
  ["other", "Other"],
] as const;

const trainingAudiences = [
  ["all_team", "All team"],
  ["managers_only", "Managers only"],
  ["selected_people", "Selected people"],
] as const;

export default function ConfigEditor({ editor, onClose, onSave, teamMembers = [] }: Props) {
  const [name, setName] = useState(editor.kind === "training" ? editor.item?.title ?? "" : editor.item?.name ?? editor.item?.question ?? "");
  const [question, setQuestion] = useState(editor.item?.question ?? "");
  const [description, setDescription] = useState(editor.item?.description ?? "");
  const [category, setCategory] = useState(editor.item?.category ?? "other");
  const [audience, setAudience] = useState(editor.item?.audience ?? "all_team");
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>(editor.item?.selectedTeamMemberIds ?? []);
  const [requireReacknowledgement, setRequireReacknowledgement] = useState(false);
  const [frequency, setFrequency] = useState(editor.item?.frequency ?? "daily");
  const [weekdays, setWeekdays] = useState((editor.item?.weekdays ?? []).join(","));
  const [minimum, setMinimum] = useState(String(editor.item?.minimumTemperature ?? 76));
  const [hold, setHold] = useState(String(editor.item?.holdMinutes ?? 2));
  const [session, setSession] = useState(editor.session ?? editor.item?.session ?? "AM");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const isQuestion = editor.kind === "question";
  const isSecurity = editor.kind === "security";
  const isCleaning = editor.kind === "cleaning";
  const isProduct = editor.kind === "product";
  const isTraining = editor.kind === "training";
  const isReplacement = isTraining && Boolean(editor.item?.documentStorageId);
  const title = editor.item ? "Edit " + editor.kind : "Add " + editor.kind;

  function toggleTeamMember(memberId: string) {
    setSelectedTeamMemberIds((current) => current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]);
  }

  async function save() {
    await onSave({
      name: (isQuestion || isSecurity) ? question.trim() : name.trim(),
      question: (isQuestion || isSecurity) ? question.trim() : undefined,
      description: isTraining ? description.trim() : undefined,
      category: isTraining ? category : undefined,
      audience: isTraining ? audience : undefined,
      selectedTeamMemberIds: isTraining && audience === "selected_people" ? selectedTeamMemberIds : [],
      requireReacknowledgement: isReplacement ? requireReacknowledgement : false,
      frequency,
      weekdays: frequency === "specific_days" ? weekdays.split(",").map(Number).filter(Boolean) : [],
      minimumTemperature: Number(minimum) || 76,
      holdMinutes: Number(hold) || 2,
      session,
      documentFile,
    });
  }

  const valid = (isQuestion || isSecurity) ? question.trim() : name.trim();

  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-h-[90vh] sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Admin setup</p><h2 className="mt-2 text-2xl font-semibold">{title}</h2></div><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></div><div className="mt-7 space-y-4">{isQuestion || isSecurity ? <><label className="block text-sm font-semibold">Question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] p-3" placeholder="Enter the question" /></label>{isSecurity && <label className="block text-sm font-semibold">Session<select value={session} onChange={(event) => setSession(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="AM">AM Security</option><option value="PM">PM Security</option></select></label>}</> : <label className="block text-sm font-semibold">{isTraining ? "Name" : "Name"}<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11" placeholder={isCleaning ? "Clean food preparation surfaces" : isProduct ? "Sausages" : isTraining ? "Training requirement" : "Wastage item"} /></label>}{isTraining && <><label className="block text-sm font-semibold">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] p-3" placeholder="Describe this training requirement" /></label><label className="block text-sm font-semibold">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">{trainingCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="block text-sm font-semibold">Audience<select value={audience} onChange={(event) => setAudience(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">{trainingAudiences.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{audience === "selected_people" && <div><p className="text-sm font-semibold">Selected people</p><div className="mt-2 space-y-2 rounded-xl border border-black/[0.1] p-3">{teamMembers.map((member) => <label key={member._id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedTeamMemberIds.includes(member._id)} onChange={() => toggleTeamMember(member._id)} /><span>{member.name}</span></label>)}{!teamMembers.length && <p className="text-sm text-[#89918b]">No active team members configured.</p>}</div></div>}{isReplacement && <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={requireReacknowledgement} onChange={(event) => setRequireReacknowledgement(event.target.checked)} />Require team to acknowledge this new version</label>}</>}{isTraining && <label className="block text-sm font-semibold">Supporting PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm" />{editor.item?.documentName && <span className="mt-2 block text-xs font-normal text-[#727a74]">Current file: {editor.item.documentName}</span>}<span className="mt-2 block text-xs font-normal text-[#89918b]">PDF only. Uploading a new file replaces the current document.</span></label>}{isCleaning && <><label className="block text-sm font-semibold">Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="after_use">After Use</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="specific_days">Specific days</option></select></label>{frequency === "specific_days" && <label className="block text-sm font-semibold">Days<Input value={weekdays} onChange={(event) => setWeekdays(event.target.value)} className="mt-2 h-11" placeholder="1,3,5 (Monday=1)" /></label>}</>}{isProduct && <div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Minimum °C<Input type="number" value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Hold minutes<Input type="number" value={hold} onChange={(event) => setHold(event.target.value)} className="mt-2 h-11" /></label></div>}</div><Button disabled={!valid} className="mt-7 h-12 w-full bg-[#ffde56] font-semibold text-[#171717]" onClick={save}>Save</Button></div></div>;
}
