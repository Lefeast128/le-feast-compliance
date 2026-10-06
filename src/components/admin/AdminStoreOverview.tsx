import AdditionalAdmin from "@/components/AdditionalAdmin";
import ConfigEditor from "@/components/ConfigEditor";
import IssueDetail from "@/components/IssueDetail";
import { FridgeEditor, ListCard, QuestionList, TeamEditor } from "@/components/admin/AdminPrimitives";
import type { AdminCleaningTask, AdminEditor, AdminEditorValues, AdminIssue, AdminQuestion, AdminSecurityQuestion, AdminStore, AdminTeamEditorMember, AdminTeamResponse, AdminTrainingRequirement, AdminWastageItem, FridgeEditorState, FridgeEditorValues } from "@/components/admin/admin-types";
import { Button } from "@/components/ui/button";
import { documentsApi, restApi, useRestMutation } from "@/lib/rest-domain";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  store: AdminStore;
  team: AdminTeamResponse | undefined;
  onOpenCatalogue: () => void;
};

type IssueUpdatePayload = Record<string, unknown>;
const trainingCategoryLabels: Record<string, string> = {
  northern_rail: "Northern Rail",
  food_safety: "Food Safety",
  security: "Security",
  equipment: "Equipment",
  alcohol: "Alcohol",
  company_procedure: "Company Procedure",
  other: "Other",
};
const trainingAudienceLabels: Record<string, string> = {
  all_team: "All team",
  managers_only: "Managers only",
  selected_people: "Selected people",
};

export default function AdminStoreOverview({ store, team, onOpenCatalogue }: Props) {
  const [teamEditor, setTeamEditor] = useState<AdminTeamEditorMember | false>(false);
  const [issueStatus, setIssueStatus] = useState("all");
  const [selectedIssue, setSelectedIssue] = useState<AdminIssue | null>(null);
  const [editor, setEditor] = useState<AdminEditor | null>(null);
  const [fridgeEditor, setFridgeEditor] = useState<FridgeEditorState | null>(null);

  const addQuestion = useRestMutation(restApi.admin.addChecklistQuestion);
  const updateQuestion = useRestMutation(restApi.admin.updateChecklistQuestion);
  const deleteQuestion = useRestMutation(restApi.admin.deleteChecklistQuestion);
  const reorderQuestion = useRestMutation(restApi.admin.reorderChecklistQuestion);
  const updateWastage = useRestMutation(restApi.admin.updateWastageItem);
  const deleteWastage = useRestMutation(restApi.admin.deleteWastageItem);
  const reorderWastage = useRestMutation(restApi.admin.reorderWastageItem);
  const addProduct = useRestMutation(restApi.admin.addProbeProduct);
  const updateProduct = useRestMutation(restApi.admin.updateProbeProduct);
  const deleteProduct = useRestMutation(restApi.admin.deleteProbeProduct);
  const addIssueUpdate = useRestMutation(restApi.compliance.addIssueUpdate);
  const addTeamMemberName = useRestMutation(restApi.admin.addTeamMemberName);
  const updateTeamMemberName = useRestMutation(restApi.admin.updateTeamMemberName);
  const deactivateTeamMember = useRestMutation(restApi.admin.deactivateTeamMember);
  const addCleaning = useRestMutation(restApi.admin.addCleaningTask);
  const updateCleaning = useRestMutation(restApi.admin.updateCleaningTask);
  const deleteCleaning = useRestMutation(restApi.admin.deleteCleaningTask);
  const reorderCleaning = useRestMutation(restApi.admin.reorderCleaningTask);
  const addSecurity = useRestMutation(restApi.admin.addSecurityQuestion);
  const updateSecurity = useRestMutation(restApi.admin.updateSecurityQuestion);
  const deleteSecurity = useRestMutation(restApi.admin.deleteSecurityQuestion);
  const setFridgeCount = useRestMutation(restApi.admin.setFridgeCount);
  const addTraining = useRestMutation(restApi.admin.addTrainingRequirement);
  const updateTraining = useRestMutation(restApi.admin.updateTrainingRequirement);
  const deleteTraining = useRestMutation(restApi.admin.deleteTrainingRequirement);
  const reorderTraining = useRestMutation(restApi.admin.reorderTrainingRequirement);
  const attachTrainingDocument = useRestMutation(restApi.admin.attachTrainingDocument);
  const removeTrainingDocument = useRestMutation(restApi.admin.removeTrainingDocument);
  const updateEquipmentLimits = useRestMutation(restApi.admin.updateEquipmentLimits);

  async function promptEditWastage(item: AdminWastageItem) {
    const name = window.prompt("Edit wastage item", item.name);
    if (name?.trim()) { await updateWastage({ itemId: item._id, name: name.trim() }); toast.success("Wastage item updated"); }
  }

  async function promptAddProduct() {
    const name = window.prompt("Add probe product");
    if (!name?.trim()) return;
    const minimum = Number(window.prompt("Minimum temperature", "76"));
    const hold = Number(window.prompt("Hold minutes", "2"));
    await addProduct({ organisationId: store.location.organisationId, name: name.trim(), minimumTemperature: minimum || 76, holdMinutes: hold || 2, locationIds: [store.location._id] });
    toast.success("Probe product added");
  }

  async function promptEditProduct(item: AdminStore["probeProducts"][number]) {
    const name = window.prompt("Edit probe product", item.name);
    if (!name?.trim()) return;
    const minimum = Number(window.prompt("Minimum temperature", String(item.minimumTemperature)));
    const hold = Number(window.prompt("Hold minutes", String(item.holdMinutes)));
    await updateProduct({ productId: item._id, name: name.trim(), minimumTemperature: minimum || item.minimumTemperature, holdMinutes: hold || item.holdMinutes });
    toast.success("Probe product updated");
  }

  function promptAddCleaning() {
    setEditor({ kind: "cleaning" });
  }

  function promptEditCleaning(item: AdminCleaningTask) {
    setEditor({ kind: "cleaning", item });
  }

  function promptAddSecurity(session: "AM" | "PM") {
    setEditor({ kind: "security", session });
  }

  function promptEditSecurity(item: AdminSecurityQuestion) {
    setEditor({ kind: "security", item, session: item.session });
  }

  async function move(kind: "question" | "wastage", id: string, direction: "up" | "down") {
    if (kind === "question") await reorderQuestion({ questionId: id, direction });
    else await reorderWastage({ itemId: id, direction });
  }

  function openEditor(kind: AdminEditor["kind"], item?: AdminEditor["item"], session?: AdminEditor["session"]) {
    if (kind === "wastage") { onOpenCatalogue(); return; }
    setEditor({ kind, item, session });
  }

  async function saveFridgeEditor(data: FridgeEditorValues) {
    const currentEditor = fridgeEditor;
    if (!currentEditor) return;
    if (currentEditor.kind === "count") await setFridgeCount({ locationId: store.location._id, count: Math.max(1, Number(data.count) || 1) });
    else if (currentEditor.item) await updateEquipmentLimits({ equipmentId: currentEditor.item._id, minimumTemperature: Number(data.minimum), preferredTemperature: Number(data.preferred), maximumTemperature: Number(data.maximum) });
    setFridgeEditor(null);
    toast.success("Fridge setup saved");
  }

  async function saveTeam(name: string, memberId?: string, role: "team" | "manager" = "team") {
    if (memberId) await updateTeamMemberName({ memberId, name, role });
    else await addTeamMemberName({ locationId: store.location._id, name, role });
    setTeamEditor(false);
    toast.success(memberId ? "Team member updated" : "Team member added");
  }

  async function saveEditor(data: AdminEditorValues) {
    if (!editor) return;
    if (editor.kind === "cleaning") {
      const item = editor.item as AdminCleaningTask | undefined;
      if (item) await updateCleaning({ taskId: item._id, name: data.name, description: data.description, taskType: data.taskType, steps: data.steps, frequency: data.frequency, weekdays: data.weekdays });
      else await addCleaning({ locationId: store.location._id, name: data.name, description: data.description, taskType: data.taskType, steps: data.steps, frequency: data.frequency, weekdays: data.weekdays });
    } else if (editor.kind === "question") {
      const item = editor.item as AdminQuestion | undefined;
      if (item) await updateQuestion({ questionId: item._id, question: data.question, description: data.description, taskType: data.taskType, steps: data.steps });
      else await addQuestion({ locationId: store.location._id, checklist: editor.session, question: data.question, description: data.description, taskType: data.taskType, steps: data.steps });
    } else if (editor.kind === "product") {
      const item = editor.item as AdminStore["probeProducts"][number] | undefined;
      if (item) await updateProduct({ productId: item._id, name: data.name, minimumTemperature: data.minimumTemperature, holdMinutes: data.holdMinutes });
      else await addProduct({ organisationId: store.location.organisationId, name: data.name, minimumTemperature: data.minimumTemperature, holdMinutes: data.holdMinutes, locationIds: [store.location._id] });
    } else if (editor.kind === "security") {
      const item = editor.item as AdminSecurityQuestion | undefined;
      if (item) await updateSecurity({ questionId: item._id, question: data.question, description: data.description, taskType: data.taskType, steps: data.steps });
      else await addSecurity({ locationId: store.location._id, session: data.session, question: data.question, description: data.description, taskType: data.taskType, steps: data.steps });
    } else if (editor.kind === "training") {
      const item = editor.item as AdminTrainingRequirement | undefined;
      const trainingData = { title: data.name, description: data.description, category: data.category, audience: data.audience, selectedTeamMemberIds: data.selectedTeamMemberIds };
      let requirementId = item?._id;
      if (item) await updateTraining({ requirementId: item._id, ...trainingData });
      else { const created = await addTraining({ locationId: store.location._id, ...trainingData }); requirementId = created?._id ?? created?.id ?? created; }
      if (data.documentFile && requirementId) {
        if (data.documentFile.type !== "application/pdf") throw new Error("Only PDF files are supported");
        const document = await documentsApi.upload({ locationId: store.location._id, file: data.documentFile, purpose: "training_document" });
        await attachTrainingDocument({ requirementId, documentId: document.id ?? document._id, requireReacknowledgement: data.requireReacknowledgement });
      }
    }
    setEditor(null);
    toast.success("Admin setup saved");
  }

  return <><div className="mt-8 grid gap-6 lg:grid-cols-2"><ListCard title="Opening Food Safety" action="Add question" onAdd={() => openEditor("question", undefined, "opening")}><QuestionList items={store.checklists.opening.questions} onEdit={(item) => openEditor("question", item, item.checklist)} onDelete={(id) => deleteQuestion({ questionId: id })} onMove={(id, direction) => move("question", id, direction)} /></ListCard><ListCard title="Closing Food Safety" action="Add question" onAdd={() => openEditor("question", undefined, "closing")}><QuestionList items={store.checklists.closing.questions} onEdit={(item) => openEditor("question", item, item.checklist)} onDelete={(id) => deleteQuestion({ questionId: id })} onMove={(id, direction) => move("question", id, direction)} /></ListCard><section className="rounded-2xl border border-black/[0.07] bg-white p-5 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Corrective Actions / Issues</h2><p className="mt-1 text-sm text-[#89918b]">Open an issue to review its full journey and add updates.</p></div><select value={issueStatus} onChange={(event) => setIssueStatus(event.target.value)} className="h-10 rounded-xl border border-black/[0.1] bg-white px-3 text-sm"><option value="all">All statuses</option><option value="open">Open</option><option value="monitoring">In progress</option><option value="resolved">Resolved</option></select></div><div className="mt-4 space-y-2">{store.issues.filter((issue) => issueStatus === "all" || issue.status === issueStatus).map((issue) => <button type="button" key={issue._id} onClick={() => setSelectedIssue(issue)} className="flex w-full items-center justify-between rounded-xl bg-[#fafbf9] px-4 py-3 text-left"><div><p className="font-semibold">{issue.title}</p><p className="mt-1 text-xs text-[#89918b]">{new Date(issue.createdAt).toLocaleString("en-GB")} · {issue.status === "monitoring" ? "In progress" : issue.status}</p></div><span className="text-sm text-[#727a74]">Open details</span></button>)}{!store.issues.length && <p className="text-sm text-[#89918b]">No issues recorded for this store.</p>}</div></section><section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Team Members</h2><p className="mt-1 text-sm text-[#89918b]">People who can complete this store&apos;s records.</p></div><Button size="sm" className="bg-[#202522] text-white" onClick={() => setTeamEditor(true)}><Plus className="mr-1 size-4" /> Add member</Button></div><div className="mt-4 space-y-2">{team?.members.map((member) => <div key={member._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><span><b>{member.name}</b><span className="ml-2 text-xs font-normal text-[#89918b]">{member.role === "manager" ? "Manager" : "Team member"}</span></span><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setTeamEditor(member)}>Edit</Button><Button variant="ghost" size="sm" className="text-[#b64738]" onClick={() => deactivateTeamMember({ memberId: member._id })}>Remove</Button></div></div>)}{!team?.members.length && <p className="text-sm text-[#89918b]">No team members configured.</p>}</div></section><ListCard title="Cleaning Tasks" action="Add task" onAdd={promptAddCleaning}><div className="space-y-2">{store.cleaningTasks.map((item, index) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><div><p className="font-semibold">{index + 1}. {item.name}{item.centralItemId && <span className="ml-2 rounded-full bg-[#e9f0e6] px-2 py-1 text-[10px] font-semibold text-[#477152]">Organisation standard</span>}</p><p className="text-xs text-[#89918b]">{item.frequency === "specific_days" ? `Specific days: ${item.weekdays.join(", ")}` : item.frequency.replace("_", " ")}</p></div>{item.centralItemId ? <span className="text-xs font-semibold text-[#477152]">Organisation standard</span> : <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => reorderCleaning({ taskId: item._id, direction: "up" })}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => reorderCleaning({ taskId: item._id, direction: "down" })}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptEditCleaning(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => deleteCleaning({ taskId: item._id })}><Trash2 className="size-4" /></Button></div>}</div>)}</div></ListCard><ListCard title="Probe Products" action="Add product" onAdd={promptAddProduct}><div className="space-y-2">{store.probeProducts.map((item) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><div><p className="font-semibold">{item.name}</p><p className="text-xs text-[#89918b]">{item.minimumTemperature}°C minimum · {item.holdMinutes} minutes</p></div><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => promptEditProduct(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => deleteProduct({ productId: item._id })}><Trash2 className="size-4" /></Button></div></div>)}{!store.probeProducts.length && <p className="text-sm text-[#89918b]">No active probe products.</p>}</div></ListCard><ListCard title="Wastage List" action="Add item" onAdd={() => openEditor("wastage")}><div className="space-y-2">{store.wastageItems.map((item, index) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><span className="font-semibold">{index + 1}. {item.name}</span><div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => move("wastage", item._id, "up")}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => move("wastage", item._id, "down")}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => promptEditWastage(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => deleteWastage({ itemId: item._id })}><Trash2 className="size-4" /></Button></div></div>)}{!store.wastageItems.length && <p className="text-sm text-[#89918b]">No active wastage items.</p>}</div></ListCard><section className="rounded-2xl border border-black/[0.07] bg-white p-5 lg:col-span-2"><h2 className="text-lg font-semibold">Security Checks</h2><div className="mt-4 grid gap-5 md:grid-cols-2">{(["AM", "PM"] as const).map((session) => <div key={session}><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wider text-[#89918b]">{session} Security</p><Button size="sm" variant="outline" onClick={() => promptAddSecurity(session)}><Plus className="mr-1 size-4" /> Add</Button></div><div className="mt-2 space-y-2">{store.security[session].map((item) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><span>{item.question}{item.centralItemId && <span className="ml-2 rounded-full bg-[#e9f0e6] px-2 py-1 text-[10px] font-semibold text-[#477152]">Organisation standard</span>}</span>{item.centralItemId ? <span className="text-xs font-semibold text-[#477152]">Organisation standard</span> : <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => promptEditSecurity(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => deleteSecurity({ questionId: item._id })}><Trash2 className="size-4" /></Button></div>}</div>)}</div></div>)}</div></section><ListCard title="Training Requirements" action="Add requirement" onAdd={() => openEditor("training")}><div className="space-y-2">{store.trainingRequirements.map((item, index) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><div><p className="font-semibold">{index + 1}. {item.title}{item.centralPublicationId && <span className="ml-2 rounded-full bg-[#e9f0e6] px-2 py-1 text-[10px] font-semibold text-[#477152]">Organisation standard</span>}</p><p className="text-xs text-[#89918b]">{trainingCategoryLabels[item.category ?? "other"]} · {trainingAudienceLabels[item.audience ?? "all_team"]}</p></div>{item.centralPublicationId ? <span className="text-xs font-semibold text-[#477152]">Organisation standard</span> : <div className="flex gap-1"><Button variant="ghost" size="icon" onClick={() => reorderTraining({ requirementId: item._id, direction: "up" })}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => reorderTraining({ requirementId: item._id, direction: "down" })}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => openEditor("training", item)}><Pencil className="size-4" /></Button>{item.documentStorageId && <Button variant="ghost" size="sm" onClick={() => removeTrainingDocument({ requirementId: item._id })}>Remove PDF</Button>}<Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => deleteTraining({ requirementId: item._id })}><Trash2 className="size-4" /></Button></div>}</div>)}{!store.trainingRequirements.length && <p className="text-sm text-[#89918b]">No active training requirements.</p>}</div></ListCard><AdditionalAdmin locationId={store.location._id} /><ListCard title="Fridges" action="Set count" onAdd={() => setFridgeEditor({ kind: "count" })}><div className="space-y-2">{store.equipment.map((item, index) => <div key={item._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><div><p className="font-semibold">Fridge {index + 1}</p><span className="text-[#89918b]">{item.preferredTemperature ?? 5}°C preferred · {item.maximumTemperature ?? 8}°C max</span></div><Button variant="ghost" size="sm" onClick={() => setFridgeEditor({ kind: "limits", item })}>Edit limits</Button></div>)}</div></ListCard></div>{editor && <ConfigEditor editor={editor} teamMembers={team?.members ?? []} onClose={() => setEditor(null)} onSave={saveEditor} />}{fridgeEditor && <FridgeEditor editor={fridgeEditor} currentCount={store.equipment.length || 1} onClose={() => setFridgeEditor(null)} onSave={saveFridgeEditor} />}{teamEditor && <TeamEditor member={teamEditor} onClose={() => setTeamEditor(false)} onSave={saveTeam} />}{selectedIssue && <IssueDetail issue={selectedIssue} teamMembers={team?.members ?? []} onUpdate={async (args: IssueUpdatePayload) => { await addIssueUpdate(args); const refreshed = store.issues.find((issue) => issue._id === selectedIssue._id); if (refreshed) setSelectedIssue(refreshed); }} onClose={() => setSelectedIssue(null)} />}</>;
}
