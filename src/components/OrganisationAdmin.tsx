import UserAccessAdmin from "@/components/UserAccessAdmin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentsApi, restApi, useRestMutation, useRestQuery } from "@/lib/rest-domain";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Store = { id: string; name: string; shortName: string };
type OrganisationControls = {
  locations: Store[];
  training: Array<{ id: string; title: string; category?: string | null; locationIds: string[]; stores: string[]; requirementIds: string[]; requirements: Array<{ id: string; locationId: string }>; version: number }>;
  checklists: Array<{ id: string; question: string; checklist: "opening" | "closing"; locationIds: string[]; stores: string[] }>;
};

type Props = { onBack: () => void };

const selectedIds = (allStores: boolean, stores: Record<string, boolean>) => allStores ? [] : Object.keys(stores).filter(id => stores[id]);

export default function OrganisationAdmin({ onBack }: Props) {
  const data = useRestQuery<OrganisationControls>("organisation-admin", restApi.admin.organisation.list, true);
  const publishTraining = useRestMutation(restApi.admin.organisation.publishTraining);
  const updateTraining = useRestMutation(restApi.admin.organisation.updateTraining);
  const publishChecklist = useRestMutation(restApi.admin.organisation.publishChecklist);
  const updateChecklist = useRestMutation(restApi.admin.organisation.updateChecklist);
  const attachDocument = useRestMutation(restApi.admin.attachTrainingDocument);
  const [trainingTitle, setTrainingTitle] = useState("");
  const [trainingDescription, setTrainingDescription] = useState("");
  const [trainingCategory, setTrainingCategory] = useState("other");
  const [trainingAudience, setTrainingAudience] = useState("all_team");
  const [trainingAllStores, setTrainingAllStores] = useState(true);
  const [trainingStores, setTrainingStores] = useState<Record<string, boolean>>({});
  const [trainingFile, setTrainingFile] = useState<File | null>(null);
  const [checklistQuestion, setChecklistQuestion] = useState("");
  const [checklistType, setChecklistType] = useState<"opening" | "closing">("opening");
  const [checklistAllStores, setChecklistAllStores] = useState(true);
  const [checklistStores, setChecklistStores] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const toggleStore = (setter: (value: Record<string, boolean>) => void, current: Record<string, boolean>, id: string) => setter({ ...current, [id]: !current[id] });

  async function saveTraining() {
    if (!trainingTitle.trim()) return;
    const locationIds = selectedIds(trainingAllStores, trainingStores);
    if (!trainingAllStores && !locationIds.length) { toast.error("Select at least one store"); return; }
    setSaving(true);
    try {
      const result = await publishTraining({ title: trainingTitle.trim(), description: trainingDescription.trim(), category: trainingCategory, audience: trainingAudience, allStores: trainingAllStores, locationIds });
      if (trainingFile && result?.requirements?.length) {
        if (trainingFile.type !== "application/pdf") throw new Error("Only PDF files are supported");
        for (const requirement of result.requirements) {
          const locationId = requirement.locationId;
          const document = await documentsApi.upload({ locationId, file: trainingFile, purpose: "training_document" });
          await attachDocument({ requirementId: requirement.id ?? requirement._id, documentId: document.id ?? document._id, requireReacknowledgement: true });
        }
      }
      setTrainingTitle(""); setTrainingDescription(""); setTrainingFile(null); toast.success("Training published to the selected stores");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to publish training"); } finally { setSaving(false); }
  }

  async function saveChecklist() {
    if (!checklistQuestion.trim()) return;
    const locationIds = selectedIds(checklistAllStores, checklistStores);
    if (!checklistAllStores && !locationIds.length) { toast.error("Select at least one store"); return; }
    setSaving(true);
    try { await publishChecklist({ question: checklistQuestion.trim(), checklist: checklistType, allStores: checklistAllStores, locationIds }); setChecklistQuestion(""); toast.success("Checklist item published to the selected stores"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to publish checklist item"); } finally { setSaving(false); }
  }

  async function editTraining(item: OrganisationControls["training"][number]) {
    const title = window.prompt("Training title", item.title);
    if (!title?.trim()) return;
    await updateTraining({ publicationId: item.id, title: title.trim(), description: "", category: item.category ?? "other", audience: "all_team", locationIds: item.locationIds, allStores: false });
    toast.success("Central training updated");
  }

  async function replaceTrainingDocument(item: OrganisationControls["training"][number], file: File) {
    if (file.type !== "application/pdf") { toast.error("Only PDF files are supported"); return; }
    const requireReacknowledgement = window.confirm("Require staff to acknowledge this document version again?");
    setSaving(true);
    try {
      for (const requirement of item.requirements) {
        const document = await documentsApi.upload({ locationId: requirement.locationId, file, purpose: "training_document" });
        await attachDocument({ requirementId: requirement.id, documentId: document.id ?? document._id, requireReacknowledgement });
      }
      toast.success("Central training document updated");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update training document"); } finally { setSaving(false); }
  }

  async function editChecklist(item: OrganisationControls["checklists"][number]) {
    const question = window.prompt("Checklist question", item.question);
    if (!question?.trim()) return;
    await updateChecklist({ centralItemId: item.id, question: question.trim(), checklist: item.checklist, locationIds: item.locationIds, allStores: false });
    toast.success("Organisation checklist updated");
  }

  const storePicker = (all: boolean, setAll: (value: boolean) => void, values: Record<string, boolean>, setValues: (value: Record<string, boolean>) => void) => <div className="space-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} /> All stores</label>{!all && <div className="grid gap-2 sm:grid-cols-2">{(data?.locations ?? []).map(store => <label key={store.id} className="flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(values[store.id])} onChange={() => toggleStore(setValues, values, store.id)} />{store.name}</label>)}</div>}</div>;

  if (!data) return <div className="p-6 text-sm text-[#727a74]">Loading organisation controls…</div>;
  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]"><header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8"><div><p className="text-[15px] font-semibold">Organisation Admin</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#737a74]">Central control</p></div><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 size-4" /> Back to Admin</Button></div></header><main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-8"><UserAccessAdmin />
    <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Training &amp; Documents</p><h1 className="mt-1 text-xl font-semibold">Publish a central training requirement</h1><p className="mt-1 text-sm text-[#727a74]">Each selected store receives its own requirement and completion history.</p></div><Plus className="size-5 text-[#89918b]" /></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Title<Input value={trainingTitle} onChange={event => setTrainingTitle(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Category<select value={trainingCategory} onChange={event => setTrainingCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="other">Other</option><option value="food_safety">Food safety</option><option value="security">Security</option><option value="equipment">Equipment</option><option value="company_procedure">Company procedure</option></select></label><label className="text-sm font-semibold md:col-span-2">Description<textarea value={trainingDescription} onChange={event => setTrainingDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="text-sm font-semibold">Audience<select value={trainingAudience} onChange={event => setTrainingAudience(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="all_team">All team</option><option value="managers_only">Managers only</option></select></label><label className="text-sm font-semibold">Document (PDF)<input type="file" accept="application/pdf" onChange={event => setTrainingFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /></label><div className="md:col-span-2">{storePicker(trainingAllStores, setTrainingAllStores, trainingStores, setTrainingStores)}</div></div><Button className="mt-5 bg-[#202522] text-white" disabled={saving || !trainingTitle.trim()} onClick={saveTraining}>{saving ? "Publishing…" : "Publish training"}</Button><div className="mt-6 space-y-2">{data.training.map(item => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3 text-sm"><div><p className="font-semibold">{item.title}</p><p className="text-xs text-[#727a74]">{item.stores.join(", ")} · Version {item.version}</p></div><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${item.title}`} onClick={() => void editTraining(item)}><Pencil className="size-4" /></Button><label className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium hover:bg-black/[0.04]">Replace document<input className="hidden" type="file" accept="application/pdf" disabled={saving} onChange={event => { const file = event.target.files?.[0]; if (file) void replaceTrainingDocument(item, file); event.target.value = ""; }} /></label></div></div>)}</div></section>
    <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Checklist Controls</p><h2 className="mt-1 text-xl font-semibold">Publish an organisation standard</h2><p className="mt-1 text-sm text-[#727a74]">Store rows are versioned safely so historical responses stay unchanged.</p></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold md:col-span-2">Question<Input value={checklistQuestion} onChange={event => setChecklistQuestion(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Checklist type<select value={checklistType} onChange={event => setChecklistType(event.target.value as "opening" | "closing")} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="opening">Opening</option><option value="closing">Closing</option></select></label><div>{storePicker(checklistAllStores, setChecklistAllStores, checklistStores, setChecklistStores)}</div></div><Button className="mt-5 bg-[#202522] text-white" disabled={saving || !checklistQuestion.trim()} onClick={saveChecklist}>{saving ? "Publishing…" : "Publish checklist item"}</Button><div className="mt-6 space-y-2">{data.checklists.map(item => <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3 text-sm"><div><p className="font-semibold">{item.question}</p><p className="text-xs text-[#727a74]">{item.checklist === "opening" ? "Opening" : "Closing"} · {item.stores.join(", ")}</p></div><Button variant="ghost" size="icon" aria-label={`Edit ${item.question}`} onClick={() => void editChecklist(item)}><Pencil className="size-4" /></Button></div>)}</div></section>
  </main></div>;
}
