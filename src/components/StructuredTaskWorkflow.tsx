import { Button } from "@/components/ui/button";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import type {
  StructuredStep,
  StructuredTask,
  StructuredTaskResponse,
  TeamMember,
} from "@/components/dashboard/dashboard-types";
import { AlertTriangle, Check } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { versionedChecklistResponseMatches } from "@/shared/unified-checklist";
import { ActiveStaffControl, StaffAttributionLine } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";

type Props = {
  locationId: string;
  locationName: string;
  area: StructuredTask["area"];
  tasks: StructuredTask[];
  responses: StructuredTaskResponse[];
  cleaningCompletions?: Array<{
    taskId: string;
    completedAt?: number | string;
    teamMemberId?: string | null;
    teamMemberName?: string | null;
  }>;
  teamMembers: TeamMember[];
  signOffRecorded?: boolean;
  onCompleteCleaning?: (taskId: string, teamMemberId: string) => Promise<void>;
  onReportCleaningIssue?: (description: string, teamMemberId: string) => Promise<void>;
  onBack: () => void;
};
type IssueDraft = { problem: string; action: string };

const responseLabel = (type: StructuredStep["responseType"]) =>
  ({
    confirm: "Confirm",
    yes_no: "Yes / No",
    number: "Number",
    short_text: "Short text",
  })[type];
const responseTime = (value?: string) => value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;

export default function StructuredTaskWorkflow({
  locationId,
  locationName,
  area,
  tasks,
  responses,
  cleaningCompletions = [],
  teamMembers,
  signOffRecorded = false,
  onCompleteCleaning,
  onReportCleaningIssue,
  onBack,
}: Props) {
  const save = useRestMutation(restApi.compliance.saveStructuredTaskResponse);
  const reportIssue = useRestMutation(restApi.compliance.createManualIssue);
  const signOff = useRestMutation(restApi.compliance.signOffStructuredTask);
  const [values, setValues] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<Record<string, IssueDraft>>({});
  const [issueOpen, setIssueOpen] = useState<string | null>(null);
  const [activeMemberId, setActiveMemberId] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const autoSignOffRef = useRef(false);
  const [localResponses, setLocalResponses] = useState<
    Record<string, StructuredTaskResponse>
  >({});
  const areaTasks = useMemo(
    () => tasks.filter((task) => task.area === area),
    [tasks, area],
  );
  const legacyCleaningResponseFor = (task: StructuredTask): StructuredTaskResponse | undefined => {
    if (area !== "cleaning" || task.taskType === "with_steps" || task.completionMode !== "task") return undefined;
    const completion = cleaningCompletions.find((item) => item.taskId === task._id);
    if (!completion) return undefined;
    return {
      _id: `legacy-cleaning-${completion.taskId}`,
      taskArea: "cleaning",
      taskId: task._id,
      stepId: "simple",
      responseType: "confirm",
      responseValue: "confirmed",
      dateKey: new Date().toISOString().slice(0, 10),
      createdAt: completion.completedAt === undefined ? undefined : new Date(completion.completedAt).toISOString(),
      teamMemberId: completion.teamMemberId,
      teamMemberName: completion.teamMemberName ?? undefined,
    };
  };
  const responseFor = (taskId: string, stepId: string) =>
    responses.find(
      (response) =>
        (response.taskId === taskId || versionedChecklistResponseMatches(areaTasks.find((task) => task._id === taskId) ?? { _id: taskId }, response)) &&
        response.taskArea === area &&
        response.stepId === stepId,
    ) ?? localResponses[`${taskId}:${stepId}`] ?? legacyCleaningResponseFor(areaTasks.find((task) => task._id === taskId) ?? { _id: taskId, area, title: "" });
  const stepsFor = (task: StructuredTask): StructuredStep[] =>
    task.taskType === "with_steps"
      ? (task.steps ?? [])
      : [
          {
            id: "simple",
            label: task.title,
            description: task.description,
            responseType: task.completionMode === "task" ? "confirm" : "yes_no",
            required: true,
          },
        ];
  const totalRequiredSteps = areaTasks.reduce(
    (total, task) => total + stepsFor(task).filter((step) => step.required !== false).length,
    0,
  );
  const completedRequiredSteps = areaTasks.reduce(
    (total, task) => total + stepsFor(task).filter((step) => step.required !== false && responseFor(task._id, step.id)).length,
    0,
  );
  const areaComplete = totalRequiredSteps > 0 && completedRequiredSteps === totalRequiredSteps;
  const isSignable = area !== "cleaning";
  const allStepsCompleteFor = (candidateResponses: Record<string, StructuredTaskResponse>) => areaTasks.every((task) =>
    stepsFor(task)
      .filter((step) => step.required !== false)
      .every((step) => Boolean(
        responses.find((response) =>
          response.taskArea === area &&
          response.stepId === step.id &&
          (response.taskId === task._id || versionedChecklistResponseMatches(task, response)),
        ) ?? candidateResponses[`${task._id}:${step.id}`],
      )),
  );
  const areaLabel =
    area === "cleaning"
      ? "Cleaning"
      : area === "security_am"
        ? "AM Security"
        : area === "security_pm"
          ? "PM Security"
          : `${area[0].toUpperCase()}${area.slice(1)} checklist`;
  const needsSignOffRecovery = isSignable && allStepsCompleteFor(localResponses) && !signOffRecorded && !completedAt;

  async function recordCompletion(memberId: string) {
    if (!isSignable || !memberId || autoSignOffRef.current) return;
    autoSignOffRef.current = true;
    setSaving("signoff");
    try {
      await signOff({ locationId, area, teamMemberId: memberId });
      setCompletedAt(new Date().toISOString());
      toast.success("Checklist complete", { description: "All required steps are recorded." });
    } catch (error) {
      autoSignOffRef.current = false;
      toast.error("Checklist could not be completed", { description: error instanceof Error ? error.message : "Please retry." });
    } finally {
      setSaving(null);
    }
  }

  async function saveStep(
    task: StructuredTask,
    step: StructuredStep,
    value = values[`${task._id}:${step.id}`],
  ) {
    const key = `${task._id}:${step.id}`;
    const memberId = members[key] || activeMemberId;
    if (!memberId || !value || saving) return;
    setSaving(key);
    try {
      const issue = issues[key];
      const usesLegacyCleaningCompletion = area === "cleaning"
        && task.taskType !== "with_steps"
        && task.completionMode === "task"
        && step.id === "simple"
        && Boolean(onCompleteCleaning);
      const result = usesLegacyCleaningCompletion
        ? await onCompleteCleaning!(task._id, memberId)
        : await save({
            locationId,
            area,
            taskId: task._id,
            stepId: step.id,
            value: step.responseType === "confirm" ? "confirmed" : value,
            teamMemberId: memberId,
            problem: issue?.problem,
            action: issue?.action,
          });
      const nextResponse: StructuredTaskResponse = {
          _id: `local-${key}`,
          taskArea: area,
          taskId: task._id,
          taskVersionRootId: task.versionRootId,
          taskDefinitionKey: task.definitionKey,
          stepId: step.id,
          responseType: step.responseType,
          responseValue: step.responseType === "confirm" ? "confirmed" : value,
          dateKey: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          teamMemberId: memberId,
        };
      const nextLocalResponses = { ...localResponses, [key]: nextResponse };
      setLocalResponses(nextLocalResponses);
      setValues((current) => ({ ...current, [key]: "" }));
      setIssueOpen(null);
      if (isSignable && allStepsCompleteFor(nextLocalResponses)) await recordCompletion(memberId);
      return result;
    } finally {
      setSaving(null);
    }
  }

  async function reportStandaloneIssue(
    task: StructuredTask,
    step: StructuredStep,
  ) {
    const key = `${task._id}:${step.id}`;
    const memberId = members[key] || activeMemberId;
    const issue = issues[key];
    if (!memberId || !issue?.problem.trim() || saving) return;
    setSaving(`issue:${key}`);
    try {
      const description = `${task.title}${step.id === "simple" ? "" : ` — ${step.label}`}\n\n${issue.problem.trim()}`;
      if (area === "cleaning" && onReportCleaningIssue) {
        await onReportCleaningIssue(description, memberId);
      } else {
        await reportIssue({
          locationId,
          teamMemberId: memberId,
          description,
        });
      }
      setIssueOpen(null);
      setIssues((current) => ({
        ...current,
        [key]: { problem: "", action: "" },
      }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <OperationalHeader
        title={areaLabel}
        eyebrow="Operational checks"
        date={operationalDateLabel()}
        subtitle={`${locationName} · Complete tasks in any order`}
        progress={{ complete: completedRequiredSteps, total: totalRequiredSteps }}
        onBack={onBack}
      />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 sm:px-6">
        <p className="text-sm leading-6 text-[#727a74]">
          Each step can be completed by the team member who carried it out.
        </p>
        <ActiveStaffControl teamMembers={teamMembers} value={activeMemberId} onChange={setActiveMemberId} />
        {area === "cleaning" && areaComplete && <section className="rounded-2xl border border-[#b9dfc5] bg-[#f3fbf5] p-4 text-[#2d7951]" role="status">
          <div className="flex items-start gap-3">
            <Check className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Cleaning complete</p>
              <p className="mt-1 text-sm">All scheduled cleaning jobs are recorded.</p>
              <Button type="button" variant="outline" className="mt-3 border-[#9bcaaa] text-[#2d7951]" onClick={onBack}>View all checks</Button>
            </div>
          </div>
        </section>}
        {needsSignOffRecovery && <section className="rounded-2xl border border-[#f0d98a] bg-[#fffdf1] p-4" role="status">
          <p className="font-semibold text-[#5f5115]">All checklist steps are recorded</p>
          <p className="mt-1 text-sm text-[#796513]">Finish recording completion to update Daily Checks.</p>
          <Button type="button" disabled={!activeMemberId || saving === "signoff"} className="mt-3 h-11 bg-[#ffde59] text-[#202522] hover:bg-[#f4d34b]" onClick={() => void recordCompletion(activeMemberId)}>
            {saving === "signoff" ? "Recording…" : "Finish recording completion"}
          </Button>
        </section>}
        {completedAt && <section className="rounded-2xl border border-[#b9dfc5] bg-[#f3fbf5] p-4 text-[#2d7951]" role="status"><div className="flex items-start gap-3"><Check className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Checklist complete</p><p className="mt-1 text-sm">Completed at {responseTime(completedAt)}. All required steps are recorded.</p><Button type="button" variant="outline" className="mt-3 border-[#9bcaaa] text-[#2d7951]" onClick={onBack}>View all checks</Button></div></div></section>}
        {areaTasks.map((task) => {
          const steps = stepsFor(task);
          const requiredSteps = steps.filter((step) => step.required !== false);
          const complete = requiredSteps.filter((step) =>
            responseFor(task._id, step.id),
          ).length;
          return (
            <section
              key={task._id}
              className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_4px_16px_rgba(23,25,24,0.04)]"
            >
              <div>
                <h2 className="text-xl font-semibold text-[#171918]">
                  {task.title}
                </h2>
                {task.description && (
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#727a74]">
                    {task.description}
                  </p>
                )}
                <p className="mt-3 text-sm font-medium text-[#68716a]">
                  {complete} of {requiredSteps.length} complete
                </p>
              </div>
              <div className="mt-5 space-y-3">
                {steps.map((step) => {
                  const response = responseFor(task._id, step.id);
                  const key = `${task._id}:${step.id}`;
                  const issue = issues[key] ?? { problem: "", action: "" };
                  const open = issueOpen === key;
                  const selectedValue = values[key] ?? "";
                  return (
                    <div
                      key={step.id}
                      className={`rounded-xl border p-4 ${response ? "border-[#cfe3d5] bg-[#fbfefb]" : "border-black/[0.07]"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p
                            className={`font-medium ${response ? "text-[#59625c]" : "text-[#303631]"}`}
                          >
                            {step.label}
                          </p>
                          {step.description && (
                            <p className="mt-1 text-sm leading-5 text-[#89918b]">
                              {step.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-[#89918b]">
                            {responseLabel(step.responseType)}
                          </p>
                        </div>
                        {response && (
                          <span className="text-right text-xs font-semibold text-[#2d7951]">
                            <span className="flex items-center gap-1">
                              Completed <Check className="size-4" />
                            </span>
                            <span className="block font-normal">
                              {teamMembers.find(
                                (member) =>
                                  member._id === response.teamMemberId,
                              )?.name ?? "Team member"}
                              {responseTime(response.createdAt) ? ` · ${responseTime(response.createdAt)}` : ""}
                            </span>
                          </span>
                        )}
                      </div>
                      {!response && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]">
                            <StaffAttributionLine
                              value={members[key] || activeMemberId}
                              teamMembers={teamMembers}
                              onChange={(value) => setMembers((current) => ({ ...current, [key]: value }))}
                              label={`Change person for ${step.label}`}
                              className="sm:col-span-2"
                            />
                            {step.responseType === "yes_no" ? (
                              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                                <Button
                                  type="button"
                                  disabled={!(members[key] || activeMemberId) || saving === key}
                                  className="h-12 bg-[#2d7951] text-white"
                                  onClick={() =>
                                    void saveStep(task, step, "yes")
                                  }
                                >
                                  Yes
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={!(members[key] || activeMemberId) || saving === key}
                                  className="h-12 border-[#b64738] text-[#8f3a31]"
                                  onClick={() => {
                                    setValues((current) => ({
                                      ...current,
                                      [key]: "no",
                                    }));
                                    setIssueOpen(key);
                                  }}
                                >
                                  No
                                </Button>
                              </div>
                            ) : (
                              <>
                                {step.responseType === "confirm" ? (
                                  <span className="hidden sm:block" />
                                ) : (
                                  <input
                                    type={
                                      step.responseType === "number"
                                        ? "number"
                                        : "text"
                                    }
                                    value={selectedValue}
                                    onChange={(event) =>
                                      setValues((current) => ({
                                        ...current,
                                        [key]: event.target.value,
                                      }))
                                    }
                                    className="h-12 min-w-0 rounded-xl border border-black/[0.1] px-3 text-sm"
                                    placeholder={
                                      step.responseType === "number"
                                        ? "Enter number"
                                        : "Enter response"
                                    }
                                  />
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    type="button"
                                    aria-label="Mark complete"
                                    disabled={
                                      !(members[key] || activeMemberId) ||
                                      (step.responseType !== "confirm" &&
                                        !selectedValue) ||
                                      saving === key
                                    }
                                    className="h-12 bg-[#2d7951] text-white hover:bg-[#246442]"
                                    onClick={() =>
                                      void saveStep(task, step, step.responseType === "confirm" ? "confirmed" : selectedValue)
                                    }
                                  >
                                    <Check className="size-6" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                    !(members[key] || activeMemberId) || saving === `issue:${key}`
                                    }
                                    className="h-12 border-[#c9a94d] text-[#7b651a]"
                                    onClick={() => setIssueOpen(key)}
                                  >
                                    <AlertTriangle className="mr-1 size-4" />{" "}
                                    Issue
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                          {open && (
                            <div className="rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4">
                              <p className="font-semibold text-[#8f3a31]">
                                What stopped this check being completed?
                              </p>
                              <textarea
                                value={issue.problem}
                                onChange={(event) =>
                                  setIssues((current) => ({
                                    ...current,
                                    [key]: {
                                      ...issue,
                                      problem: event.target.value,
                                    },
                                  }))
                                }
                                className="mt-3 min-h-24 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                                placeholder="Short explanation"
                              />
                              {step.responseType === "yes_no" && (
                                <textarea
                                  value={issue.action}
                                  onChange={(event) =>
                                    setIssues((current) => ({
                                      ...current,
                                      [key]: {
                                        ...issue,
                                        action: event.target.value,
                                      },
                                    }))
                                  }
                                  className="mt-3 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                                  placeholder="What action was taken?"
                                />
                              )}
                              <div className="mt-3 flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => setIssueOpen(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  disabled={
                                    !issue.problem.trim() ||
                                    (step.responseType === "yes_no" &&
                                      !issue.action.trim()) ||
                                    saving?.startsWith("issue:") ||
                                    !(members[key] || activeMemberId)
                                  }
                                  className="bg-[#202522] text-white"
                                  onClick={() =>
                                    step.responseType === "yes_no"
                                      ? void saveStep(task, step, "no")
                                      : void reportStandaloneIssue(task, step)
                                  }
                                >
                                  Report issue
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        {!areaTasks.length && (
          <p className="rounded-2xl bg-white p-5 text-sm text-[#727a74]">
            No structured tasks are due here today.
          </p>
        )}
      </main>
    </div>
  );
}
