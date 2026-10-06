import { Button } from "@/components/ui/button";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import type { StructuredStep, StructuredTask, StructuredTaskResponse, TeamMember } from "@/components/dashboard/dashboard-types";
import { Check, ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  locationId: string;
  locationName: string;
  area: StructuredTask["area"];
  tasks: StructuredTask[];
  responses: StructuredTaskResponse[];
  teamMembers: TeamMember[];
  onBack: () => void;
};

const responseLabel = (type: StructuredStep["responseType"]) => ({
  confirm: "Confirm",
  yes_no: "Yes / No",
  number: "Number",
  short_text: "Short text",
}[type]);

export default function StructuredTaskWorkflow({ locationId, locationName, area, tasks, responses, teamMembers, onBack }: Props) {
  const save = useRestMutation(restApi.compliance.saveStructuredTaskResponse);
  const signOff = useRestMutation(restApi.compliance.signOffStructuredTask);
  const [values, setValues] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<Record<string, { problem: string; action: string }>>({});
  const [signOffMember, setSignOffMember] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const areaTasks = useMemo(() => tasks.filter(task => task.area === area), [tasks, area]);
  const responseFor = (taskId: string, stepId: string) => responses.find(response => response.taskId === taskId && response.taskArea === area && response.stepId === stepId);
  const allStepsComplete = areaTasks.every(task => (task.steps ?? []).filter(step => step.required !== false).every(step => Boolean(responseFor(task._id, step.id))));
  const isSignable = area !== "cleaning";
  const areaLabel = area === "cleaning" ? "Cleaning" : area === "security_am" ? "AM Security" : area === "security_pm" ? "PM Security" : `${area[0].toUpperCase()}${area.slice(1)} checklist`;

  async function saveStep(task: StructuredTask, step: StructuredStep) {
    const memberId = members[`${task._id}:${step.id}`];
    const value = values[`${task._id}:${step.id}`];
    if (!memberId || !value || saving) return;
    setSaving(`${task._id}:${step.id}`);
    try {
      const issue = issues[`${task._id}:${step.id}`];
      await save({ locationId, area, taskId: task._id, stepId: step.id, value: step.responseType === "confirm" ? "confirmed" : value, teamMemberId: memberId, problem: issue?.problem, action: issue?.action });
      setValues(current => ({ ...current, [`${task._id}:${step.id}`]: "" }));
    } finally {
      setSaving(null);
    }
  }

  async function completeSignOff() {
    if (!signOffMember || !allStepsComplete) return;
    setSaving("signoff");
    try { await signOff({ locationId, area, teamMemberId: signOffMember }); } finally { setSaving(null); }
  }

  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4"><Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="size-5" /></Button><div><p className="font-semibold">{areaLabel}</p><p className="text-xs text-[#89918b]">{locationName} · Complete tasks in any order</p></div></div></header>
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 sm:px-6">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Structured task</p><h1 className="mt-2 text-3xl font-semibold">{areaLabel}</h1><p className="mt-2 text-sm text-[#727a74]">Each step can be completed by the team member who carried it out.</p></div>
      {areaTasks.map(task => {
        const steps = task.taskType === "with_steps" ? (task.steps ?? []) : [{ id: "simple", label: task.title, description: task.description, responseType: "confirm" as const, required: true }];
        const complete = steps.filter(step => step.required !== false).filter(step => responseFor(task._id, step.id)).length;
        return <section key={task._id} className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_4px_16px_rgba(23,25,24,0.04)]"><div><h2 className="text-xl font-semibold text-[#171918]">{task.title}</h2>{task.description && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#727a74]">{task.description}</p>}<p className="mt-3 text-sm font-medium text-[#68716a]">{complete} of {steps.filter(step => step.required !== false).length} complete</p></div><div className="mt-5 space-y-3">{steps.map(step => { const response = responseFor(task._id, step.id); const key = `${task._id}:${step.id}`; const issue = issues[key] ?? { problem: "", action: "" }; return <div key={step.id} className={`rounded-xl border p-4 ${response ? "border-[#cfe3d5] bg-[#fbfefb]" : "border-black/[0.07]"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-[#303631]">{step.label}</p>{step.description && <p className="mt-1 text-sm leading-5 text-[#89918b]">{step.description}</p>}<p className="mt-1 text-xs text-[#89918b]">{responseLabel(step.responseType)}</p></div>{response && <span className="text-right text-xs font-semibold text-[#2d7951]"><span className="flex items-center gap-1">Completed <Check className="size-4" /></span><span className="block font-normal">{teamMembers.find(member => member._id === response.teamMemberId)?.name ?? "Team member"}</span></span>}</div>{!response && <div className="mt-3 space-y-2"><div className="flex gap-2"><select value={members[key] ?? ""} onChange={event => setMembers(current => ({ ...current, [key]: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-white px-3 text-sm"><option value="">Completed by…</option>{teamMembers.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}</select>{step.responseType === "yes_no" ? <select value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} className="h-11 rounded-xl border border-black/[0.1] bg-white px-3 text-sm"><option value="">Answer…</option><option value="yes">Yes</option><option value="no">No</option></select> : step.responseType === "confirm" ? <Button type="button" variant={values[key] === "confirmed" ? "default" : "outline"} className="h-11" onClick={() => setValues(current => ({ ...current, [key]: "confirmed" }))}>Confirm</Button> : <input type={step.responseType === "number" ? "number" : "text"} value={values[key] ?? ""} onChange={event => setValues(current => ({ ...current, [key]: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-xl border border-black/[0.1] px-3 text-sm" placeholder={step.responseType === "number" ? "Enter number" : "Enter response"} />}<Button disabled={!members[key] || !values[key] || saving === key || (values[key] === "no" && (!issue.problem.trim() || !issue.action.trim()))} className="h-11 bg-[#ffde56] text-[#171717]" onClick={() => void saveStep(task, step)}>Save</Button></div>{step.responseType === "yes_no" && values[key] === "no" && <div className="grid gap-2 sm:grid-cols-2"><textarea value={issue.problem} onChange={event => setIssues(current => ({ ...current, [key]: { ...issue, problem: event.target.value } }))} className="min-h-20 rounded-xl border border-[#efc8c3] p-3 text-sm" placeholder="What was wrong?" /><textarea value={issue.action} onChange={event => setIssues(current => ({ ...current, [key]: { ...issue, action: event.target.value } }))} className="min-h-20 rounded-xl border border-[#efc8c3] p-3 text-sm" placeholder="What action was taken?" /></div>}</div>}</div>; })}</div></section>;
      })}
      {isSignable && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="font-semibold">{area.startsWith("security_") ? "Security sign-off" : "Checklist sign-off"}</h2><p className="mt-1 text-sm text-[#727a74]">Sign off once every required step is complete.</p><select value={signOffMember} onChange={event => setSignOffMember(event.target.value)} className="mt-4 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Signed off by…</option>{teamMembers.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}</select><Button disabled={!allStepsComplete || !signOffMember || saving === "signoff"} className="mt-4 h-12 w-full bg-[#ffde56] text-[#171717]" onClick={() => void completeSignOff()}>Complete sign-off <Check className="ml-2 size-4" /></Button></section>}
      {!areaTasks.length && <p className="rounded-2xl bg-white p-5 text-sm text-[#727a74]">No structured tasks are due here today.</p>}
    </main>
  </div>;
}
