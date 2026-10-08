import { Button } from "@/components/ui/button";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import { buildBulkCompletionPlan, isItemComplete, isSimpleCompletionTask, checklistProgress, type UnifiedItem } from "@/lib/unified-checklist";
import type { ChecklistResponse, StructuredStep, StructuredTaskResponse, TeamMember } from "@/components/dashboard/dashboard-types";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Circle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { versionedChecklistResponseMatches } from "@/shared/unified-checklist";

type ChecklistTask = UnifiedItem & { title: string; description?: string | null; taskType?: "simple" | "with_steps"; steps?: StructuredStep[] };
type Props = { locationId: string; checklist: "opening" | "closing"; title: string; tasks: ChecklistTask[]; legacyResponses: ChecklistResponse[]; structuredResponses: StructuredTaskResponse[]; teamMembers: TeamMember[]; onSignOff: (teamMemberId: string) => Promise<void>; onBack: () => void };
type IssueDraft = { problem: string; action: string };
type MemberMap = Record<string, string>;
const timeLabel = (value?: number | string) => value === undefined ? null : new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const stepLabel = (step: StructuredStep) => step.responseType === "yes_no" ? "Yes / No" : step.responseType === "number" ? "Number" : step.responseType === "short_text" ? "Short text" : "Confirm";

export default function InlineChecklist({ locationId, checklist, title, tasks, legacyResponses, structuredResponses, teamMembers, onSignOff, onBack }: Props) {
  const saveLegacy = useRestMutation(restApi.compliance.saveChecklistResponse);
  const saveStructured = useRestMutation(restApi.compliance.saveStructuredTaskResponse);
  const reportManualIssue = useRestMutation(restApi.compliance.createManualIssue);
  const [workflowMemberId, setWorkflowMemberId] = useState("");
  const [overrides, setOverrides] = useState<MemberMap>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>({});
  const [issueOpen, setIssueOpen] = useState<string | null>(null);
  const [selectedSimple, setSelectedSimple] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [signOffMemberId, setSignOffMemberId] = useState("");
  const [localLegacyResponses, setLocalLegacyResponses] = useState<ChecklistResponse[]>([]);
  const [localStructuredResponses, setLocalStructuredResponses] = useState<StructuredTaskResponse[]>([]);
  const effectiveLegacyResponses = [...legacyResponses, ...localLegacyResponses].filter((response, index, all) => all.findIndex(candidate => candidate.questionId === response.questionId) === index);
  const effectiveStructuredResponses = [...structuredResponses, ...localStructuredResponses].filter((response, index, all) => all.findIndex(candidate => candidate.taskId === response.taskId && candidate.taskArea === response.taskArea && candidate.stepId === response.stepId) === index);
  const legacy = effectiveLegacyResponses.map((response) => ({ questionId: response.questionId, questionVersionRootId: response.questionVersionRootId, questionDefinitionKey: response.questionDefinitionKey }));
  const structured = effectiveStructuredResponses.map((response) => ({ taskId: response.taskId, stepId: response.stepId, taskVersionRootId: response.taskVersionRootId, taskDefinitionKey: response.taskDefinitionKey }));
  const progress = checklistProgress(tasks, legacy, structured);
  const memberFor = (key: string) => overrides[key] || workflowMemberId;
  const memberName = (id?: string | null) => teamMembers.find((member) => member._id === id)?.name ?? "Not recorded";
  const responseFor = (taskId: string, stepId: string) => {
    const task = tasks.find((candidate) => candidate._id === taskId);
    return effectiveStructuredResponses.find((response) => response.taskArea === checklist && response.stepId === stepId && task && versionedChecklistResponseMatches(task, response));
  };
  const legacyFor = (taskId: string) => {
    const task = tasks.find((candidate) => candidate._id === taskId);
    return effectiveLegacyResponses.find((response) => task && versionedChecklistResponseMatches(task, response));
  };
  const responseTime = (response?: StructuredTaskResponse | ChecklistResponse) => timeLabel(response?.createdAt);
  const completedTask = (task: ChecklistTask) => isItemComplete(task, legacy, structured);
  const bulkPlan = buildBulkCompletionPlan(tasks, selectedSimple, workflowMemberId, overrides, legacy, structured);
  const bulkMissingMember = bulkPlan.some((entry) => !entry.teamMemberId);

  function selectAllSimple() {
    const eligible = tasks.filter((task) => isSimpleCompletionTask(task) && !completedTask(task)).map((task) => task._id);
    setSelectedSimple((current) => current.length === eligible.length ? [] : eligible);
  }
  async function saveSimpleTask(task: ChecklistTask, memberId = memberFor(task._id)) {
    if (!memberId || saving || completedTask(task)) return;
    setSaving(task._id);
    try {
      await saveStructured({ locationId, area: checklist, taskId: task._id, stepId: "simple", value: "confirmed", teamMemberId: memberId });
      setLocalStructuredResponses(current => [...current, { _id: `local-${task._id}-simple`, taskArea: checklist, taskId: task._id, stepId: "simple", responseType: "confirm", responseValue: "confirmed", dateKey: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), teamMemberId: memberId, taskVersionRootId: task.versionRootId, taskDefinitionKey: task.definitionKey }]);
      toast.success("Task completed");
    } finally { setSaving(null); }
  }
  async function saveQuestion(task: ChecklistTask, answer: "yes" | "no", memberId = memberFor(task._id)) {
    if (!memberId || saving || completedTask(task)) return;
    const issue = issueDrafts[task._id];
    if (answer === "no" && (!issue?.problem.trim() || !issue.action.trim())) return;
    setSaving(task._id);
    try {
      await saveLegacy({ locationId, checklist, questionId: task._id, answer, problem: issue?.problem, action: issue?.action, teamMemberId: memberId });
      setLocalLegacyResponses(current => [...current, { _id: `local-${task._id}`, questionId: task._id, answer, problem: issue?.problem, action: issue?.action, teamMemberId: memberId, createdAt: new Date().toISOString(), questionVersionRootId: task.versionRootId, questionDefinitionKey: task.definitionKey }]);
      setIssueOpen(null); toast.success(answer === "no" ? "Issue and action recorded" : "Answer recorded");
    } finally { setSaving(null); }
  }
  async function reportSimpleTaskIssue(task: ChecklistTask, memberId = memberFor(task._id)) {
    const issue = issueDrafts[task._id];
    if (!memberId || !issue?.problem.trim() || !issue.action.trim() || saving) return;
    setSaving(`issue:${task._id}`);
    try {
      await reportManualIssue({ locationId, teamMemberId: memberId, description: `${task.title}\n\n${issue.problem.trim()}\n\nCorrective action: ${issue.action.trim()}` });
      setIssueOpen(null);
      setIssueDrafts((current) => ({ ...current, [task._id]: { problem: "", action: "" } }));
      toast.success("Issue reported");
    } finally { setSaving(null); }
  }
  async function saveStep(task: ChecklistTask, step: StructuredStep, memberId = memberFor(`${task._id}:${step.id}`), value = values[`${task._id}:${step.id}`]) {
    const key = `${task._id}:${step.id}`;
    if (!memberId || !value || saving || responseFor(task._id, step.id)) return;
    const issue = issueDrafts[key];
    if (step.responseType === "yes_no" && value === "no" && (!issue?.problem.trim() || !issue.action.trim())) return;
    setSaving(key);
    try {
      const responseValue = step.responseType === "confirm" ? "confirmed" : value;
      await saveStructured({ locationId, area: checklist, taskId: task._id, stepId: step.id, value: responseValue, teamMemberId: memberId, problem: issue?.problem, action: issue?.action });
      setLocalStructuredResponses(current => [...current, { _id: `local-${task._id}-${step.id}`, taskArea: checklist, taskId: task._id, stepId: step.id, responseType: step.responseType, responseValue, dateKey: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), teamMemberId: memberId, taskVersionRootId: task.versionRootId, taskDefinitionKey: task.definitionKey }]);
      setIssueOpen(null); setValues((current) => ({ ...current, [key]: "" })); toast.success("Step recorded");
    } finally { setSaving(null); }
  }
  async function reportStepIssue(task: ChecklistTask, step: StructuredStep, memberId = memberFor(`${task._id}:${step.id}`)) {
    const key = `${task._id}:${step.id}`;
    const issue = issueDrafts[key];
    if (!memberId || !issue?.problem.trim() || saving) return;
    setSaving(`issue:${key}`);
    try {
      await reportManualIssue({ locationId, teamMemberId: memberId, description: `${task.title} — ${step.label}\n\n${issue.problem.trim()}` });
      setIssueOpen(null);
      setIssueDrafts((current) => ({ ...current, [key]: { problem: "", action: "" } }));
      toast.success("Issue reported");
    } finally { setSaving(null); }
  }
  async function confirmBulk() {
    const plan = buildBulkCompletionPlan(tasks, selectedSimple, workflowMemberId, overrides, legacy, structured);
    if (saving || !plan.length || plan.some((entry) => !entry.teamMemberId)) return;
    setSaving("bulk");
    let savedCount = 0;
    const unsaved = new Set(plan.map((entry) => entry.taskId));
    try {
      for (const entry of plan) {
        const task = tasks.find((candidate) => candidate._id === entry.taskId);
        if (!task || completedTask(task)) {
          unsaved.delete(entry.taskId);
          continue;
        }
        await saveStructured({ locationId, area: checklist, taskId: entry.taskId, stepId: "simple", value: "confirmed", teamMemberId: entry.teamMemberId });
        setLocalStructuredResponses(current => [...current, { _id: `local-${entry.taskId}-simple`, taskArea: checklist, taskId: entry.taskId, stepId: "simple", responseType: "confirm", responseValue: "confirmed", dateKey: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), teamMemberId: entry.teamMemberId, taskVersionRootId: task?.versionRootId, taskDefinitionKey: task?.definitionKey }]);
        unsaved.delete(entry.taskId);
        savedCount += 1;
      }
      setSelectedSimple([]);
      setBulkOpen(false);
      toast.success(`${savedCount} task${savedCount === 1 ? "" : "s"} completed`);
    } catch (error) {
      setSelectedSimple([...unsaved]);
      toast.error(`${savedCount} task${savedCount === 1 ? "" : "s"} saved. ${unsaved.size} remain to complete.`, { description: error instanceof Error ? error.message : "The remaining tasks were not saved." });
    } finally { setSaving(null); }
  }
  async function signOff() {
    const memberId = signOffMemberId || workflowMemberId;
    if (!progress.allComplete || !memberId || saving) return;
    setSaving("signoff");
    try { await onSignOff(memberId); } finally { setSaving(null); }
  }

  return <div className="min-h-screen bg-[#f6f7f5] pb-24 text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to daily checks"><ChevronLeft className="size-5" /></Button><div><p className="font-semibold">{title}</p><p className="text-xs text-[#89918b]">Complete each item in the configured order</p></div></div></header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 sm:px-6">
      <section className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Daily checklist</p><h1 className="mt-2 text-3xl font-semibold">{title}</h1></div><p className="text-sm font-semibold text-[#59625c]">{progress.complete} of {progress.total}</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0eb]"><div className="h-full rounded-full bg-[#2d7951] transition-[width]" style={{ width: `${progress.total ? (progress.complete / progress.total) * 100 : 0}%` }} /></div></section>
      <label className="block rounded-2xl border border-black/[0.07] bg-white p-4 text-sm font-semibold shadow-sm">Completing as:<select value={workflowMemberId} onChange={(event) => setWorkflowMemberId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3" aria-label="Default team member"><option value="">Select team member</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label>
      {tasks.some((task) => isSimpleCompletionTask(task) && !completedTask(task)) && <section className="rounded-2xl border border-[#eadb9a] bg-[#fffdf0] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">Simple completion tasks</p><p className="text-sm text-[#727a74]">Select eligible tasks, then confirm once they are done.</p></div><Button type="button" variant="outline" onClick={selectAllSimple}>Select all simple tasks</Button></div>{selectedSimple.length > 0 && <div className="mt-3 rounded-xl bg-white p-3"><p className="text-sm font-semibold">{bulkPlan.length} task{bulkPlan.length === 1 ? "" : "s"} selected</p><p className="mt-1 text-xs text-[#727a74]">Review who will be recorded for each task before confirming.</p><Button type="button" disabled={!bulkPlan.length || bulkMissingMember || saving === "bulk"} className="mt-3 h-11 w-full bg-[#ffde56] font-semibold text-[#171717]" onClick={() => setBulkOpen(true)}>Review and confirm</Button></div>}</section>}
      <div className="space-y-3">{tasks.map((task) => {
        const complete = completedTask(task); const taskResponse = task.taskType === "with_steps" ? null : responseFor(task._id, "simple"); const legacyResponse = legacyFor(task._id); const issue = legacyResponse?.answer === "no" || taskResponse?.responseValue === "no"; const steps = task.taskType === "with_steps" ? task.steps ?? [] : []; const doneSteps = steps.filter((step) => responseFor(task._id, step.id));
        return <section key={task._id} className={`rounded-2xl border bg-white p-5 shadow-sm ${issue ? "border-[#efc8c3]" : "border-black/[0.07]"}`}>
          <div className="flex items-start justify-between gap-4"><div className="min-w-0">{!complete && isSimpleCompletionTask(task) && <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#59625c]"><input type="checkbox" checked={selectedSimple.includes(task._id)} onChange={(event) => setSelectedSimple((current) => event.target.checked ? [...new Set([...current, task._id])] : current.filter((id) => id !== task._id))} aria-label={`Select ${task.title} for bulk completion`} className="size-4 rounded border-black/[0.2]" />Select for bulk completion</label>}<h2 className={`text-lg font-semibold ${complete ? "text-[#59625c]" : "text-[#171918]"}`}>{task.title}</h2>{task.description && <p className="mt-1 text-sm leading-6 text-[#727a74]">{task.description}</p>}{task.taskType === "with_steps" && <p className="mt-2 text-xs font-semibold text-[#727a74]">{doneSteps.length} of {steps.filter((step) => step.required !== false).length} required steps complete</p>}</div>{complete && <span className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${issue ? "text-[#b64738]" : "text-[#2d7951]"}`}>{issue ? "Issue" : "Complete"} <Check className="size-4" /></span>}</div>
          {complete && task.taskType === "with_steps" ? <div className="mt-3 space-y-2 rounded-xl bg-[#fafbf9] p-3">{steps.map((step) => { const response = responseFor(task._id, step.id); return response ? <div key={step.id} className="flex items-start justify-between gap-3 text-xs"><span className="font-medium text-[#59625c]">{step.label}<span className="ml-2 font-normal text-[#89918b]">{response.responseValue}</span></span><span className="shrink-0 text-right text-[#727a74]">{memberName(response.teamMemberId)}{responseTime(response) ? ` · ${responseTime(response)}` : ""}</span></div> : null; })}</div> : complete && <p className="mt-3 text-xs text-[#727a74]">Completed by {memberName(taskResponse?.teamMemberId ?? legacyResponse?.teamMemberId)}{responseTime(taskResponse ?? legacyResponse) ? ` · ${responseTime(taskResponse ?? legacyResponse)}` : ""}</p>}
          {!complete && task.taskType !== "with_steps" && task.completionMode === "task" && <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.8fr)]"><select value={memberFor(task._id)} onChange={(event) => setOverrides((current) => ({ ...current, [task._id]: event.target.value }))} className="h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3" aria-label={`Completed by for ${task.title}`}><option value="">Completed by…</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Button type="button" aria-label={`Mark ${task.title} complete`} disabled={!memberFor(task._id) || saving === task._id} className="h-12 w-full bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => void saveSimpleTask(task)}>{saving === task._id ? <Loader2 className="mx-auto size-5 animate-spin" /> : <><Check className="mr-2 size-5" />Complete</>}</Button><Button type="button" variant="outline" disabled={!memberFor(task._id)} className="h-12 w-full border-[#c9a94d] text-[#7b651a]" onClick={() => setIssueOpen(issueOpen === task._id ? null : task._id)}><AlertTriangle className="mr-1 size-4" />Issue</Button></div></div>}
          {!complete && task.taskType !== "with_steps" && task.completionMode !== "task" && <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]"><select value={memberFor(task._id)} onChange={(event) => setOverrides((current) => ({ ...current, [task._id]: event.target.value }))} className="h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3" aria-label={`Answered by for ${task.title}`}><option value="">Answered by…</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Button type="button" disabled={!memberFor(task._id) || saving === task._id} className="h-12 bg-[#2d7951] text-white" onClick={() => void saveQuestion(task, "yes")}><Check className="mr-1 size-5" />Yes</Button><Button type="button" variant="outline" disabled={!memberFor(task._id)} className="h-12 border-[#c9a94d] text-[#7b651a]" onClick={() => setIssueOpen(issueOpen === task._id ? null : task._id)}><AlertTriangle className="mr-1 size-4" />No</Button></div></div>}
          {issueOpen === task._id && <div className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4"><p className="font-semibold text-[#8f3a31]">Report an issue</p><textarea value={issueDrafts[task._id]?.problem ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [task._id]: { problem: event.target.value, action: current[task._id]?.action ?? "" } }))} className="mt-3 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm" placeholder="What was wrong?" /><textarea value={issueDrafts[task._id]?.action ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [task._id]: { problem: current[task._id]?.problem ?? "", action: event.target.value } }))} className="mt-3 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm" placeholder="What action was taken?" /><Button type="button" disabled={!memberFor(task._id) || !issueDrafts[task._id]?.problem.trim() || !issueDrafts[task._id]?.action.trim() || saving === task._id || saving === `issue:${task._id}`} className="mt-3 h-11 bg-[#202522] text-white" onClick={() => task.completionMode === "task" ? void reportSimpleTaskIssue(task) : void saveQuestion(task, "no")}>Report issue</Button></div>}
          {!complete && task.taskType === "with_steps" && <div className="mt-4 space-y-3">{steps.map((step) => { const key = `${task._id}:${step.id}`; const response = responseFor(task._id, step.id); const memberId = memberFor(key); const issueKey = issueOpen === key; const stepIssue = issueDrafts[key]; const selectedValue = values[key] ?? ""; return <div key={step.id} className="rounded-xl bg-[#fafbf9] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{step.label}{step.required === false && <span className="ml-2 text-xs font-normal text-[#89918b]">Optional</span>}</p>{step.description && <p className="mt-1 text-sm leading-5 text-[#727a74]">{step.description}</p>}<p className="mt-1 text-xs text-[#89918b]">{stepLabel(step)}</p></div>{response && <span className="flex items-center gap-1 text-sm font-semibold text-[#2d7951]"><Check className="size-4" />{memberName(response.teamMemberId)}</span>}</div>{!response && <><select value={memberId} onChange={(event) => setOverrides((current) => ({ ...current, [key]: event.target.value }))} className="mt-3 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm" aria-label={`Completed by for ${step.label}`}><option value="">Completed by…</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select>{step.responseType === "yes_no" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" disabled={!memberId} className="h-11 bg-[#2d7951] text-white" onClick={() => { setValues((current) => ({ ...current, [key]: "yes" })); void saveStep(task, step, memberId, "yes"); }}>Yes</Button><Button type="button" variant="outline" disabled={!memberId} className="h-11 border-[#c9a94d] text-[#7b651a]" onClick={() => { setValues((current) => ({ ...current, [key]: "no" })); setIssueOpen(key); }}>No</Button></div> : <div className="mt-3 flex gap-2">{step.responseType !== "confirm" && <input type={step.responseType === "number" ? "number" : "text"} value={selectedValue} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-white px-3" aria-label={step.label} placeholder={step.responseType === "number" ? "Enter number" : "Enter response"} />}{step.responseType === "confirm" && <span className="flex flex-1 items-center text-sm text-[#727a74]">Ready to confirm</span>}<Button type="button" aria-label={`Complete ${step.label}`} disabled={!memberId || (step.responseType !== "confirm" && !selectedValue) || saving === key} className="h-11 bg-[#2d7951] text-white" onClick={() => void saveStep(task, step, memberId, step.responseType === "confirm" ? "confirmed" : selectedValue)}>{saving === key ? <Loader2 className="size-5" /> : <Check className="size-5" />}</Button>{step.responseType !== "short_text" && <Button type="button" variant="outline" disabled={!memberId} className="h-11 border-[#c9a94d] text-[#7b651a]" onClick={() => setIssueOpen(key)}>Issue</Button>}</div>}{issueKey && <div className="mt-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3"><textarea value={stepIssue?.problem ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [key]: { problem: event.target.value, action: current[key]?.action ?? "" } }))} className="min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What was wrong?" />{step.responseType === "yes_no" && <textarea value={stepIssue?.action ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [key]: { problem: current[key]?.problem ?? "", action: event.target.value } }))} className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What action was taken?" />}<Button type="button" disabled={!memberId || !stepIssue?.problem.trim() || (step.responseType === "yes_no" && !stepIssue.action.trim()) || saving === `issue:${key}`} className="mt-2 bg-[#202522] text-white" onClick={() => step.responseType === "yes_no" ? (setValues((current) => ({ ...current, [key]: "no" })), void saveStep(task, step, memberId, "no")) : void reportStepIssue(task, step, memberId)}>Report issue</Button></div>}</>}</div>; })}</div>}
        </section>;
      })}</div>
      <section className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-sm"><p className="font-semibold">Checklist sign-off</p><p className="mt-1 text-sm text-[#727a74]">Sign off once every configured item has been answered or completed.</p><select value={signOffMemberId || workflowMemberId} onChange={(event) => setSignOffMemberId(event.target.value)} className="mt-4 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3" aria-label="Signed off by"><option value="">Select team member</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select><Button type="button" disabled={!progress.allComplete || !(signOffMemberId || workflowMemberId) || saving === "signoff"} className="mt-4 h-12 w-full bg-[#ffde56] font-semibold text-[#171717]" onClick={() => void signOff()}>{saving === "signoff" ? <Loader2 className="mx-auto size-5 animate-spin" /> : <>Complete {title}<Check className="ml-2 size-4" /></>}</Button></section>
      <Button variant="outline" className="w-full" onClick={onBack}>View all checks <ChevronRight className="ml-2 size-4" /></Button>
    </main>
    {bulkOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"><div role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl"><div className="flex items-start gap-3"><Circle className="mt-1 size-5 text-[#7b651a]" /><div><h2 className="text-xl font-semibold">Confirm simple tasks</h2><p className="mt-2 text-sm text-[#727a74]">Each selected task will keep its own timestamp and attribution.</p></div></div><div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl border border-black/[0.07] p-3">{bulkPlan.map((entry) => <div key={entry.taskId} className="flex items-start justify-between gap-3 text-sm"><span>{tasks.find((task) => task._id === entry.taskId)?.title ?? "Task"}</span><span className="shrink-0 font-semibold text-[#59625c]">{entry.teamMemberId ? memberName(entry.teamMemberId) : "Select a team member"}</span></div>)}</div>{bulkMissingMember && <p className="mt-3 text-sm font-semibold text-[#8f3a31]">Select a team member for every task before confirming.</p>}<div className="mt-5 flex gap-2"><Button type="button" variant="outline" className="flex-1" onClick={() => setBulkOpen(false)}>Cancel</Button><Button type="button" disabled={!bulkPlan.length || bulkMissingMember || saving === "bulk"} className="flex-1 bg-[#2d7951] text-white" onClick={() => void confirmBulk()}>{saving === "bulk" ? <Loader2 className="mx-auto size-5" /> : "Confirm completion"}</Button></div></div></div>}
  </div>;
}
