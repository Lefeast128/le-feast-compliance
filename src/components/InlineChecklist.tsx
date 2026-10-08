import { Button } from "@/components/ui/button";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import {
  buildBulkCompletionPlan,
  checklistProgress,
  isItemComplete,
  isSimpleCompletionTask,
  type UnifiedItem,
} from "@/lib/unified-checklist";
import type {
  ChecklistResponse,
  StructuredStep,
  StructuredTaskResponse,
  TeamMember,
} from "@/components/dashboard/dashboard-types";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Loader2,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { versionedChecklistResponseMatches } from "@/shared/unified-checklist";

type ChecklistTask = UnifiedItem & {
  title: string;
  description?: string | null;
  taskType?: "simple" | "with_steps";
  steps?: StructuredStep[];
};
type Props = {
  locationId: string;
  checklist: "opening" | "closing";
  title: string;
  tasks: ChecklistTask[];
  legacyResponses: ChecklistResponse[];
  structuredResponses: StructuredTaskResponse[];
  teamMembers: TeamMember[];
  onSignOff: (teamMemberId: string) => Promise<void>;
  onBack: () => void;
};
type IssueDraft = { problem: string; action: string };
type MemberMap = Record<string, string>;

const timeLabel = (value?: number | string) =>
  value === undefined
    ? null
    : new Date(value).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
const dateLabel = (value = new Date()) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
const stepLabel = (step: StructuredStep) =>
  step.responseType === "yes_no"
    ? "Yes / No"
    : step.responseType === "number"
      ? "Number"
      : step.responseType === "short_text"
        ? "Short text"
        : "Confirm";

function MemberSelect({
  label,
  value,
  teamMembers,
  onChange,
}: {
  label: string;
  value: string;
  teamMembers: TeamMember[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#727a74]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm font-medium normal-case tracking-normal text-[#171918] outline-none transition focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40"
        aria-label={label}
      >
        <option value="">Select team member</option>
        {teamMembers.map((member) => (
          <option key={member._id} value={member._id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function InlineChecklist({
  locationId,
  checklist,
  title,
  tasks,
  legacyResponses,
  structuredResponses,
  teamMembers,
  onSignOff,
  onBack,
}: Props) {
  const saveLegacy = useRestMutation(restApi.compliance.saveChecklistResponse);
  const saveStructured = useRestMutation(
    restApi.compliance.saveStructuredTaskResponse,
  );
  const reportManualIssue = useRestMutation(
    restApi.compliance.createManualIssue,
  );
  const [workflowMemberId, setWorkflowMemberId] = useState("");
  const [overrides, setOverrides] = useState<MemberMap>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [issueDrafts, setIssueDrafts] = useState<Record<string, IssueDraft>>(
    {},
  );
  const [issueOpen, setIssueOpen] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [selectedSimple, setSelectedSimple] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [signOffMemberId, setSignOffMemberId] = useState("");
  const [localLegacyResponses, setLocalLegacyResponses] = useState<
    ChecklistResponse[]
  >([]);
  const [localStructuredResponses, setLocalStructuredResponses] = useState<
    StructuredTaskResponse[]
  >([]);

  const effectiveLegacyResponses = [
    ...legacyResponses,
    ...localLegacyResponses,
  ].filter(
    (response, index, all) =>
      all.findIndex(
        (candidate) => candidate.questionId === response.questionId,
      ) === index,
  );
  const effectiveStructuredResponses = [
    ...structuredResponses,
    ...localStructuredResponses,
  ].filter(
    (response, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.taskId === response.taskId &&
          candidate.taskArea === response.taskArea &&
          candidate.stepId === response.stepId,
      ) === index,
  );
  const legacy = effectiveLegacyResponses.map((response) => ({
    questionId: response.questionId,
    questionVersionRootId: response.questionVersionRootId,
    questionDefinitionKey: response.questionDefinitionKey,
  }));
  const structured = effectiveStructuredResponses.map((response) => ({
    taskId: response.taskId,
    stepId: response.stepId,
    taskVersionRootId: response.taskVersionRootId,
    taskDefinitionKey: response.taskDefinitionKey,
  }));
  const progress = checklistProgress(tasks, legacy, structured);
  const completionPercent = progress.total
    ? Math.round((progress.complete / progress.total) * 100)
    : 0;
  const memberFor = (key: string) => overrides[key] || workflowMemberId;
  const memberName = (id?: string | null) =>
    teamMembers.find((member) => member._id === id)?.name ?? "Not recorded";
  const responseFor = (taskId: string, stepId: string) => {
    const task = tasks.find((candidate) => candidate._id === taskId);
    return effectiveStructuredResponses.find(
      (response) =>
        response.taskArea === checklist &&
        response.stepId === stepId &&
        task &&
        versionedChecklistResponseMatches(task, response),
    );
  };
  const legacyFor = (taskId: string) => {
    const task = tasks.find((candidate) => candidate._id === taskId);
    return effectiveLegacyResponses.find(
      (response) => task && versionedChecklistResponseMatches(task, response),
    );
  };
  const responseTime = (response?: StructuredTaskResponse | ChecklistResponse) =>
    timeLabel(response?.createdAt);
  const completedTask = (task: ChecklistTask) =>
    isItemComplete(task, legacy, structured);
  const bulkPlan = buildBulkCompletionPlan(
    tasks,
    selectedSimple,
    workflowMemberId,
    overrides,
    legacy,
    structured,
  );
  const bulkMissingMember = bulkPlan.some((entry) => !entry.teamMemberId);
  const eligibleSimpleTasks = tasks.filter(
    (task) => isSimpleCompletionTask(task) && !completedTask(task),
  );
  const allSimpleSelected =
    eligibleSimpleTasks.length > 0 &&
    eligibleSimpleTasks.every((task) => selectedSimple.includes(task._id));

  function updateOverride(key: string, value: string) {
    setOverrides((current) => ({ ...current, [key]: value }));
  }
  function toggleTask(taskId: string) {
    setExpandedTaskId((current) => (current === taskId ? null : taskId));
  }
  function selectAllSimple() {
    const eligible = eligibleSimpleTasks.map((task) => task._id);
    setSelectedSimple((current) =>
      current.length === eligible.length ? [] : eligible,
    );
  }

  async function saveSimpleTask(
    task: ChecklistTask,
    memberId = memberFor(task._id),
  ) {
    if (!memberId || saving || completedTask(task)) return;
    setSaving(task._id);
    try {
      await saveStructured({
        locationId,
        area: checklist,
        taskId: task._id,
        stepId: "simple",
        value: "confirmed",
        teamMemberId: memberId,
      });
      setLocalStructuredResponses((current) => [
        ...current,
        {
          _id: `local-${task._id}-simple`,
          taskArea: checklist,
          taskId: task._id,
          stepId: "simple",
          responseType: "confirm",
          responseValue: "confirmed",
          dateKey: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          teamMemberId: memberId,
          taskVersionRootId: task.versionRootId,
          taskDefinitionKey: task.definitionKey,
        },
      ]);
      setSelectedSimple((current) => current.filter((id) => id !== task._id));
      setExpandedTaskId(null);
      toast.success("Task completed");
    } finally {
      setSaving(null);
    }
  }

  async function saveQuestion(
    task: ChecklistTask,
    answer: "yes" | "no",
    memberId = memberFor(task._id),
  ) {
    if (!memberId || saving || completedTask(task)) return;
    const issue = issueDrafts[task._id];
    if (answer === "no" && (!issue?.problem.trim() || !issue.action.trim())) {
      return;
    }
    setSaving(task._id);
    try {
      await saveLegacy({
        locationId,
        checklist,
        questionId: task._id,
        answer,
        problem: issue?.problem,
        action: issue?.action,
        teamMemberId: memberId,
      });
      setLocalLegacyResponses((current) => [
        ...current,
        {
          _id: `local-${task._id}`,
          questionId: task._id,
          answer,
          problem: issue?.problem,
          action: issue?.action,
          teamMemberId: memberId,
          createdAt: new Date().toISOString(),
          questionVersionRootId: task.versionRootId,
          questionDefinitionKey: task.definitionKey,
        },
      ]);
      setIssueOpen(null);
      setExpandedTaskId(null);
      toast.success(
        answer === "no" ? "Issue and action recorded" : "Answer recorded",
      );
    } finally {
      setSaving(null);
    }
  }

  async function reportSimpleTaskIssue(
    task: ChecklistTask,
    memberId = memberFor(task._id),
  ) {
    const issue = issueDrafts[task._id];
    if (!memberId || !issue?.problem.trim() || !issue.action.trim() || saving) {
      return;
    }
    setSaving(`issue:${task._id}`);
    try {
      await reportManualIssue({
        locationId,
        teamMemberId: memberId,
        description: `${task.title}\n\n${issue.problem.trim()}\n\nCorrective action: ${issue.action.trim()}`,
      });
      setIssueOpen(null);
      setIssueDrafts((current) => ({
        ...current,
        [task._id]: { problem: "", action: "" },
      }));
      toast.success("Issue reported");
    } finally {
      setSaving(null);
    }
  }

  async function saveStep(
    task: ChecklistTask,
    step: StructuredStep,
    memberId = memberFor(`${task._id}:${step.id}`),
    value = values[`${task._id}:${step.id}`],
  ) {
    const key = `${task._id}:${step.id}`;
    if (!memberId || !value || saving || responseFor(task._id, step.id)) {
      return;
    }
    const issue = issueDrafts[key];
    if (
      step.responseType === "yes_no" &&
      value === "no" &&
      (!issue?.problem.trim() || !issue.action.trim())
    ) {
      return;
    }
    setSaving(key);
    try {
      const responseValue = step.responseType === "confirm" ? "confirmed" : value;
      await saveStructured({
        locationId,
        area: checklist,
        taskId: task._id,
        stepId: step.id,
        value: responseValue,
        teamMemberId: memberId,
        problem: issue?.problem,
        action: issue?.action,
      });
      setLocalStructuredResponses((current) => [
        ...current,
        {
          _id: `local-${task._id}-${step.id}`,
          taskArea: checklist,
          taskId: task._id,
          stepId: step.id,
          responseType: step.responseType,
          responseValue,
          dateKey: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          teamMemberId: memberId,
          taskVersionRootId: task.versionRootId,
          taskDefinitionKey: task.definitionKey,
        },
      ]);
      setIssueOpen(null);
      setValues((current) => ({ ...current, [key]: "" }));
      toast.success("Step recorded");
    } finally {
      setSaving(null);
    }
  }

  async function reportStepIssue(
    task: ChecklistTask,
    step: StructuredStep,
    memberId = memberFor(`${task._id}:${step.id}`),
  ) {
    const key = `${task._id}:${step.id}`;
    const issue = issueDrafts[key];
    if (!memberId || !issue?.problem.trim() || saving) return;
    setSaving(`issue:${key}`);
    try {
      await reportManualIssue({
        locationId,
        teamMemberId: memberId,
        description: `${task.title} — ${step.label}\n\n${issue.problem.trim()}`,
      });
      setIssueOpen(null);
      setIssueDrafts((current) => ({
        ...current,
        [key]: { problem: "", action: "" },
      }));
      toast.success("Issue reported");
    } finally {
      setSaving(null);
    }
  }

  async function confirmBulk() {
    const plan = buildBulkCompletionPlan(
      tasks,
      selectedSimple,
      workflowMemberId,
      overrides,
      legacy,
      structured,
    );
    if (saving || !plan.length || plan.some((entry) => !entry.teamMemberId)) {
      return;
    }
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
        await saveStructured({
          locationId,
          area: checklist,
          taskId: entry.taskId,
          stepId: "simple",
          value: "confirmed",
          teamMemberId: entry.teamMemberId,
        });
        setLocalStructuredResponses((current) => [
          ...current,
          {
            _id: `local-${entry.taskId}-simple`,
            taskArea: checklist,
            taskId: entry.taskId,
            stepId: "simple",
            responseType: "confirm",
            responseValue: "confirmed",
            dateKey: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
            teamMemberId: entry.teamMemberId,
            taskVersionRootId: task?.versionRootId,
            taskDefinitionKey: task?.definitionKey,
          },
        ]);
        unsaved.delete(entry.taskId);
        savedCount += 1;
      }
      setSelectedSimple([]);
      setBulkOpen(false);
      toast.success(`${savedCount} task${savedCount === 1 ? "" : "s"} completed`);
    } catch (error) {
      setSelectedSimple([...unsaved]);
      toast.error(
        `${savedCount} task${savedCount === 1 ? "" : "s"} saved. ${unsaved.size} remain to complete.`,
        {
          description:
            error instanceof Error
              ? error.message
              : "The remaining tasks were not saved.",
        },
      );
    } finally {
      setSaving(null);
    }
  }

  async function signOff() {
    const memberId = signOffMemberId || workflowMemberId;
    if (!progress.allComplete || !memberId || saving) return;
    setSaving("signoff");
    try {
      await onSignOff(memberId);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] pb-[calc(7rem+env(safe-area-inset-bottom))] text-[#171918]">
      <header className="sticky top-0 z-20 border-b border-black/[0.07] bg-white/95 shadow-[0_1px_10px_rgba(23,25,24,0.04)] backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to daily checks" className="shrink-0 rounded-full">
            <ChevronLeft className="size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 shrink-0 text-[#8e7818]" />
              <p className="truncate text-sm font-semibold">{title}</p>
            </div>
            <p className="mt-0.5 text-xs text-[#89918b]">{dateLabel()}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-bold text-[#303631]">{progress.complete} / {progress.total}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#89918b]">complete</p>
          </div>
        </div>
        <div className="mx-auto h-1 max-w-3xl overflow-hidden bg-[#e9ede8] sm:rounded-full">
          <div className="h-full rounded-full bg-[#2d7951] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${completionPercent}%` }} aria-label={`${completionPercent}% complete`} />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
        <section className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_4px_16px_rgba(23,25,24,0.04)] sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff7c9] text-[#796513]"><UserRound className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">Completing as</p>
              <p className="mt-0.5 text-sm text-[#59625c]">Default for new answers and tasks.</p>
            </div>
            <select value={workflowMemberId} onChange={(event) => setWorkflowMemberId(event.target.value)} className="h-11 max-w-[10.5rem] rounded-xl border border-black/[0.1] bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40" aria-label="Default team member">
              <option value="">Select person</option>
              {teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
            </select>
          </div>
        </section>

        {eligibleSimpleTasks.length > 0 && <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-xs text-[#727a74]">{selectedSimple.length > 0 ? `${selectedSimple.length} simple task${selectedSimple.length === 1 ? "" : "s"} selected` : "Simple tasks can be selected together."}</p>
          <button type="button" onClick={selectAllSimple} className="rounded-full px-3 py-2 text-xs font-bold text-[#796513] transition hover:bg-[#fff7c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde56]" aria-pressed={allSimpleSelected}>{allSimpleSelected ? "Clear selection" : "Select all simple tasks"}</button>
        </div>}

        <div className="space-y-2" aria-label={`${title} items`}>
          {tasks.map((task, index) => {
            const complete = completedTask(task);
            const expanded = expandedTaskId === task._id;
            const taskResponse = task.taskType === "with_steps" ? null : responseFor(task._id, "simple");
            const legacyResponse = legacyFor(task._id);
            const steps = task.taskType === "with_steps" ? task.steps ?? [] : [];
            const requiredSteps = steps.filter((step) => step.required !== false);
            const doneSteps = requiredSteps.filter((step) => responseFor(task._id, step.id));
            const issue = legacyResponse?.answer === "no" || taskResponse?.responseValue === "no" || steps.some((step) => responseFor(task._id, step.id)?.responseValue === "no");
            const status = issue ? "Requires attention" : complete ? "Complete" : task.taskType === "with_steps" ? `${doneSteps.length} of ${requiredSteps.length} required steps` : task.completionMode === "task" ? "Ready to complete" : "Awaiting answer";
            const taskPanelId = `checklist-item-${task._id}`;
            return <section key={task._id} className={`overflow-hidden rounded-2xl border bg-white shadow-[0_2px_10px_rgba(23,25,24,0.035)] transition-shadow ${issue ? "border-[#efc8c3] shadow-[0_2px_12px_rgba(182,71,56,0.08)]" : complete ? "border-[#cfe3d5]" : "border-black/[0.07]"}`}>
              <div className="flex min-h-16 items-center gap-3 px-3 py-3 sm:px-4">
                {isSimpleCompletionTask(task) && !complete ? <input type="checkbox" checked={selectedSimple.includes(task._id)} onChange={(event) => setSelectedSimple((current) => event.target.checked ? [...new Set([...current, task._id])] : current.filter((id) => id !== task._id))} aria-label={`Select ${task.title} for bulk completion`} className="size-5 shrink-0 rounded border-black/[0.2] accent-[#2d7951] focus-visible:ring-2 focus-visible:ring-[#ffde56]" /> : <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${issue ? "bg-[#fff0ed] text-[#b64738]" : complete ? "bg-[#eaf6ed] text-[#2d7951]" : "bg-[#f1f3ef] text-[#89918b]"}`} aria-hidden="true">{issue ? <AlertTriangle className="size-4" /> : complete ? <Check className="size-4" /> : <span className="text-xs font-bold">{index + 1}</span>}</span>}
                <button type="button" onClick={() => toggleTask(task._id)} aria-expanded={expanded} aria-controls={taskPanelId} className="min-w-0 flex-1 rounded-lg py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#ffde56]">
                  <span className="block truncate text-sm font-semibold text-[#202522] sm:text-base">{task.title}</span>
                  <span className={`mt-0.5 block text-xs font-medium ${issue ? "text-[#b64738]" : complete ? "text-[#2d7951]" : "text-[#727a74]"}`}>{status}{task.taskType === "with_steps" && !issue && !complete ? " to go" : ""}</span>
                </button>
                {isSimpleCompletionTask(task) && !complete && <Button type="button" size="icon" aria-label={`Mark ${task.title} complete`} disabled={!memberFor(task._id) || saving === task._id} onClick={() => void saveSimpleTask(task)} className="size-10 shrink-0 rounded-xl bg-[#2d7951] text-white shadow-sm hover:bg-[#246442]">{saving === task._id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-5" />}</Button>}
                <ChevronDown className={`size-4 shrink-0 text-[#89918b] transition-transform duration-200 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </div>

              {expanded && <div id={taskPanelId} className="border-t border-black/[0.06] bg-[#fbfcfa] px-3 pb-4 pt-3 sm:px-4">
                {task.description && <p className="mb-4 whitespace-pre-line text-sm leading-6 text-[#727a74]">{task.description}</p>}
                {complete && task.taskType === "with_steps" ? <div className="space-y-2" aria-label="Recorded step responses">{steps.map((step) => { const response = responseFor(task._id, step.id); if (!response) return null; return <div key={step.id} className="rounded-xl border border-[#cfe3d5] bg-white px-3 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-[#303631]">{step.label}</p><p className="mt-1 text-sm text-[#59625c]">{response.responseValue}</p></div><span className="shrink-0 text-right text-xs text-[#727a74]"><span className="block font-semibold text-[#2d7951]">{memberName(response.teamMemberId)}</span>{responseTime(response) && <span className="mt-0.5 block">{responseTime(response)}</span>}</span></div></div>; })}</div> : complete ? <div className="flex items-center gap-2 rounded-xl border border-[#cfe3d5] bg-[#f7fcf8] px-3 py-3 text-sm"><CheckCircle2 className="size-5 shrink-0 text-[#2d7951]" /><span className="text-[#59625c]">Recorded by <strong className="text-[#303631]">{memberName(taskResponse?.teamMemberId ?? legacyResponse?.teamMemberId)}</strong>{responseTime(taskResponse ?? legacyResponse) && <span className="text-[#727a74]"> · {responseTime(taskResponse ?? legacyResponse)}</span>}</span></div> : task.taskType === "with_steps" ? <div className="space-y-3">{steps.map((step) => {
                  const key = `${task._id}:${step.id}`;
                  const response = responseFor(task._id, step.id);
                  const issueKey = issueOpen === key;
                  const stepIssue = issueDrafts[key];
                  const selectedValue = values[key] ?? "";
                  const memberId = memberFor(key);
                  return <div key={step.id} className={`rounded-xl border bg-white p-3 ${response ? "border-[#cfe3d5]" : "border-black/[0.07]"}`}>
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-[#303631]">{step.label}{step.required === false && <span className="ml-2 text-xs font-normal text-[#89918b]">Optional</span>}</p>{step.description && <p className="mt-1 whitespace-pre-line text-sm leading-5 text-[#727a74]">{step.description}</p>}<p className="mt-1 text-xs text-[#89918b]">{stepLabel(step)}</p></div>{response && <span className="shrink-0 text-right text-xs text-[#727a74]"><span className="block font-semibold text-[#2d7951]">{memberName(response.teamMemberId)}</span>{responseTime(response) && <span className="mt-0.5 block">{responseTime(response)}</span>}</span>}</div>
                    {!response && <div className="mt-3"><MemberSelect label="Completed by" value={memberId} teamMembers={teamMembers} onChange={(value) => updateOverride(key, value)} />{step.responseType === "yes_no" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" disabled={!memberId || saving === key} className="h-11 rounded-xl bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => { setValues((current) => ({ ...current, [key]: "yes" })); void saveStep(task, step, memberId, "yes"); }}>Yes</Button><Button type="button" variant="outline" disabled={!memberId} className="h-11 rounded-xl border-[#c9a94d] text-[#7b651a]" onClick={() => { setValues((current) => ({ ...current, [key]: "no" })); setIssueOpen(key); }}>No</Button></div> : <div className="mt-3 flex gap-2">{step.responseType !== "confirm" && <input type={step.responseType === "number" ? "number" : "text"} value={selectedValue} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} className="h-11 min-w-0 flex-1 rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40" aria-label={step.label} placeholder={step.responseType === "number" ? "Enter number" : "Enter response"} />}{step.responseType === "confirm" && <span className="flex flex-1 items-center text-sm text-[#727a74]">Ready to confirm</span>}<Button type="button" aria-label={`Complete ${step.label}`} disabled={!memberId || (step.responseType !== "confirm" && !selectedValue) || saving === key} className="h-11 rounded-xl bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => void saveStep(task, step, memberId, step.responseType === "confirm" ? "confirmed" : selectedValue)}>{saving === key ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}</Button>{step.responseType !== "short_text" && <Button type="button" variant="outline" disabled={!memberId} className="h-11 rounded-xl border-[#c9a94d] px-3 text-[#7b651a]" onClick={() => setIssueOpen(key)}><AlertTriangle className="size-4" /><span className="sr-only">Issue</span></Button>}</div>}{issueKey && <div className="mt-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3"><p className="text-sm font-semibold text-[#8f3a31]">Report an issue</p><textarea value={stepIssue?.problem ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [key]: { problem: event.target.value, action: current[key]?.action ?? "" } }))} className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What was wrong?" />{step.responseType === "yes_no" && <textarea value={stepIssue?.action ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [key]: { problem: current[key]?.problem ?? "", action: event.target.value } }))} className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What action was taken?" />}<Button type="button" disabled={!memberId || !stepIssue?.problem.trim() || (step.responseType === "yes_no" && !stepIssue.action.trim()) || saving === `issue:${key}`} className="mt-2 h-10 rounded-xl bg-[#202522] text-white" onClick={() => step.responseType === "yes_no" ? void saveStep(task, step, memberId, "no") : void reportStepIssue(task, step, memberId)}>Report issue</Button></div>}</div>}
                  </div>;
                })}</div> : <div className="space-y-3"><MemberSelect label={task.completionMode === "task" ? "Completed by" : "Answered by"} value={memberFor(task._id)} teamMembers={teamMembers} onChange={(value) => updateOverride(task._id, value)} />{task.completionMode === "task" ? <div className="grid grid-cols-2 gap-2"><Button type="button" disabled={!memberFor(task._id) || saving === task._id} className="h-11 rounded-xl bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => void saveSimpleTask(task)}>{saving === task._id ? <Loader2 className="size-5 animate-spin" /> : <><Check className="mr-2 size-5" />Complete</>}</Button><Button type="button" variant="outline" disabled={!memberFor(task._id)} className="h-11 rounded-xl border-[#c9a94d] text-[#7b651a]" onClick={() => setIssueOpen(issueOpen === task._id ? null : task._id)}><AlertTriangle className="mr-1 size-4" />Issue</Button></div> : <div className="grid grid-cols-2 gap-2"><Button type="button" disabled={!memberFor(task._id) || saving === task._id} className="h-11 rounded-xl bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => void saveQuestion(task, "yes")}>Yes</Button><Button type="button" variant="outline" disabled={!memberFor(task._id)} className="h-11 rounded-xl border-[#c9a94d] text-[#7b651a]" onClick={() => setIssueOpen(issueOpen === task._id ? null : task._id)}><AlertTriangle className="mr-1 size-4" />No — report issue</Button></div>}{issueOpen === task._id && <div className="rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3"><p className="text-sm font-semibold text-[#8f3a31]">Report an issue</p><textarea value={issueDrafts[task._id]?.problem ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [task._id]: { problem: event.target.value, action: current[task._id]?.action ?? "" } }))} className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What was wrong?" /><textarea value={issueDrafts[task._id]?.action ?? ""} onChange={(event) => setIssueDrafts((current) => ({ ...current, [task._id]: { problem: current[task._id]?.problem ?? "", action: event.target.value } }))} className="mt-2 min-h-16 w-full rounded-xl border border-black/[0.1] bg-white p-2 text-sm" placeholder="What action was taken?" /><Button type="button" disabled={!memberFor(task._id) || !issueDrafts[task._id]?.problem.trim() || !issueDrafts[task._id]?.action.trim() || saving === task._id || saving === `issue:${task._id}`} className="mt-2 h-10 rounded-xl bg-[#202522] text-white" onClick={() => task.completionMode === "task" ? void reportSimpleTaskIssue(task) : void saveQuestion(task, "no")}>Report issue</Button></div>}</div>}
                  </div>}
              </section>;
          })}
        </div>

        <section className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_4px_16px_rgba(23,25,24,0.04)] sm:p-5">
          <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#2d7951]" /><div><p className="font-semibold">Checklist sign-off</p><p className="mt-1 text-sm leading-5 text-[#727a74]">Sign off once every configured item has been answered or completed.</p></div></div>
          <select value={signOffMemberId || workflowMemberId} onChange={(event) => setSignOffMemberId(event.target.value)} className="mt-4 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40" aria-label="Signed off by"><option value="">Select team member</option>{teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}</select>
          <Button type="button" disabled={!progress.allComplete || !(signOffMemberId || workflowMemberId) || saving === "signoff"} className="mt-3 h-11 w-full rounded-xl bg-[#ffde56] font-semibold text-[#171717] hover:bg-[#f4d34d]" onClick={() => void signOff()}>{saving === "signoff" ? <Loader2 className="mx-auto size-5 animate-spin" /> : <>Complete {title}<Check className="ml-2 size-4" /></>}</Button>
        </section>
        <Button variant="outline" className="h-11 w-full rounded-xl" onClick={onBack}>View all checks<ChevronRight className="ml-2 size-4" /></Button>
      </main>

      {selectedSimple.length > 0 && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.08] bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-8px_24px_rgba(23,25,24,0.08)] backdrop-blur sm:px-6"><div className="mx-auto flex max-w-3xl items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#202522]">{selectedSimple.length} simple task{selectedSimple.length === 1 ? "" : "s"} selected</p><p className="truncate text-xs text-[#727a74]">{workflowMemberId ? `New tasks will be recorded by ${memberName(workflowMemberId)}` : "Select a default person before confirming"}</p></div><Button type="button" disabled={!bulkPlan.length || bulkMissingMember || saving === "bulk"} className="h-11 shrink-0 rounded-xl bg-[#ffde56] px-4 font-semibold text-[#171717] hover:bg-[#f4d34d]" onClick={() => setBulkOpen(true)}>Review and confirm</Button></div></div>}

      {bulkOpen && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#171918]/35 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:items-center sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="bulk-confirm-title" className="w-full max-w-md rounded-3xl border border-black/[0.08] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#fff7c9] text-[#7b651a]"><Circle className="size-5" /></div><div><h2 id="bulk-confirm-title" className="text-lg font-semibold">Confirm simple tasks</h2><p className="mt-1 text-sm leading-5 text-[#727a74]">Review the person recorded for each selected task before saving.</p></div></div><div className="mt-4 max-h-56 space-y-2 overflow-auto rounded-xl border border-black/[0.07] bg-[#fbfcfa] p-2">{bulkPlan.map((entry) => <div key={entry.taskId} className="flex items-start justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm"><span className="min-w-0 text-[#303631]">{tasks.find((task) => task._id === entry.taskId)?.title ?? "Task"}</span><span className="shrink-0 font-semibold text-[#59625c]">{entry.teamMemberId ? memberName(entry.teamMemberId) : "Select a team member"}</span></div>)}</div>{bulkMissingMember && <p className="mt-3 text-sm font-semibold text-[#8f3a31]">Select a team member for every task before confirming.</p>}<div className="mt-5 flex gap-2"><Button type="button" variant="outline" className="h-11 flex-1 rounded-xl" onClick={() => setBulkOpen(false)}>Cancel</Button><Button type="button" disabled={!bulkPlan.length || bulkMissingMember || saving === "bulk"} className="h-11 flex-1 rounded-xl bg-[#2d7951] text-white hover:bg-[#246442]" onClick={() => void confirmBulk()}>{saving === "bulk" ? <Loader2 className="mx-auto size-5" /> : "Confirm completion"}</Button></div></div></div>}
    </div>
  );
}
