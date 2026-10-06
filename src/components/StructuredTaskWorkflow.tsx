import { Button } from "@/components/ui/button";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import type {
  StructuredStep,
  StructuredTask,
  StructuredTaskResponse,
  TeamMember,
} from "@/components/dashboard/dashboard-types";
import { AlertTriangle, Check, ChevronLeft } from "lucide-react";
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
type IssueDraft = { problem: string; action: string };

const responseLabel = (type: StructuredStep["responseType"]) =>
  ({
    confirm: "Confirm",
    yes_no: "Yes / No",
    number: "Number",
    short_text: "Short text",
  })[type];

export default function StructuredTaskWorkflow({
  locationId,
  locationName,
  area,
  tasks,
  responses,
  teamMembers,
  onBack,
}: Props) {
  const save = useRestMutation(restApi.compliance.saveStructuredTaskResponse);
  const reportIssue = useRestMutation(restApi.compliance.createManualIssue);
  const signOff = useRestMutation(restApi.compliance.signOffStructuredTask);
  const [values, setValues] = useState<Record<string, string>>({});
  const [members, setMembers] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<Record<string, IssueDraft>>({});
  const [issueOpen, setIssueOpen] = useState<string | null>(null);
  const [signOffMember, setSignOffMember] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [localResponses, setLocalResponses] = useState<
    Record<string, StructuredTaskResponse>
  >({});
  const areaTasks = useMemo(
    () => tasks.filter((task) => task.area === area),
    [tasks, area],
  );
  const responseFor = (taskId: string, stepId: string) =>
    responses.find(
      (response) =>
        response.taskId === taskId &&
        response.taskArea === area &&
        response.stepId === stepId,
    ) ?? localResponses[`${taskId}:${stepId}`];
  const stepsFor = (task: StructuredTask): StructuredStep[] =>
    task.taskType === "with_steps"
      ? (task.steps ?? [])
      : [
          {
            id: "simple",
            label: task.title,
            description: task.description,
            responseType: "confirm",
            required: true,
          },
        ];
  const allStepsComplete = areaTasks.every((task) =>
    stepsFor(task)
      .filter((step) => step.required !== false)
      .every((step) => Boolean(responseFor(task._id, step.id))),
  );
  const isSignable = area !== "cleaning";
  const areaLabel =
    area === "cleaning"
      ? "Cleaning"
      : area === "security_am"
        ? "AM Security"
        : area === "security_pm"
          ? "PM Security"
          : `${area[0].toUpperCase()}${area.slice(1)} checklist`;

  async function saveStep(
    task: StructuredTask,
    step: StructuredStep,
    value = values[`${task._id}:${step.id}`],
  ) {
    const key = `${task._id}:${step.id}`;
    const memberId = members[key];
    if (!memberId || !value || saving) return;
    setSaving(key);
    try {
      const issue = issues[key];
      const result = await save({
        locationId,
        area,
        taskId: task._id,
        stepId: step.id,
        value: step.responseType === "confirm" ? "confirmed" : value,
        teamMemberId: memberId,
        problem: issue?.problem,
        action: issue?.action,
      });
      setLocalResponses((current) => ({
        ...current,
        [key]: {
          _id: `local-${key}`,
          taskArea: area,
          taskId: task._id,
          stepId: step.id,
          responseType: step.responseType,
          responseValue: step.responseType === "confirm" ? "confirmed" : value,
          dateKey: new Date().toISOString().slice(0, 10),
          createdAt: new Date().toISOString(),
          teamMemberId: memberId,
        },
      }));
      setValues((current) => ({ ...current, [key]: "" }));
      setIssueOpen(null);
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
    const memberId = members[key];
    const issue = issues[key];
    if (!memberId || !issue?.problem.trim() || saving) return;
    setSaving(`issue:${key}`);
    try {
      await reportIssue({
        locationId,
        teamMemberId: memberId,
        description: `${task.title}${step.id === "simple" ? "" : ` — ${step.label}`}\n\n${issue.problem.trim()}`,
      });
      setIssueOpen(null);
      setIssues((current) => ({
        ...current,
        [key]: { problem: "", action: "" },
      }));
    } finally {
      setSaving(null);
    }
  }

  async function completeSignOff() {
    if (!signOffMember || !allStepsComplete) return;
    setSaving("signoff");
    try {
      await signOff({ locationId, area, teamMemberId: signOffMember });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <p className="font-semibold">{areaLabel}</p>
            <p className="text-xs text-[#89918b]">
              {locationName} · Complete tasks in any order
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 sm:px-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
            Structured task
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{areaLabel}</h1>
          <p className="mt-2 text-sm text-[#727a74]">
            Each step can be completed by the team member who carried it out.
          </p>
        </div>
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
                            </span>
                          </span>
                        )}
                      </div>
                      {!response && (
                        <div className="mt-4 space-y-3">
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]">
                            <select
                              aria-label={`Completed by for ${step.label}`}
                              value={members[key] ?? ""}
                              onChange={(event) =>
                                setMembers((current) => ({
                                  ...current,
                                  [key]: event.target.value,
                                }))
                              }
                              className="h-12 min-w-0 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm sm:col-span-2"
                            >
                              <option value="">Completed by…</option>
                              {teamMembers.map((member) => (
                                <option key={member._id} value={member._id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                            {step.responseType === "yes_no" ? (
                              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                                <Button
                                  type="button"
                                  disabled={!members[key] || saving === key}
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
                                  disabled={!members[key] || saving === key}
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
                                      !members[key] ||
                                      (step.responseType !== "confirm" &&
                                        !selectedValue) ||
                                      saving === key
                                    }
                                    className="h-12 bg-[#2d7951] text-white hover:bg-[#246442]"
                                    onClick={() =>
                                      void saveStep(
                                        task,
                                        step,
                                        step.responseType === "confirm"
                                          ? "confirmed"
                                          : selectedValue,
                                      )
                                    }
                                  >
                                    <Check className="size-6" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    disabled={
                                      !members[key] || saving === `issue:${key}`
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
                                    !members[key]
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
        {isSignable && (
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <h2 className="font-semibold">
              {area.startsWith("security_")
                ? "Security sign-off"
                : "Checklist sign-off"}
            </h2>
            <p className="mt-1 text-sm text-[#727a74]">
              Sign off once every required step is complete.
            </p>
            <select
              value={signOffMember}
              onChange={(event) => setSignOffMember(event.target.value)}
              className="mt-4 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
            >
              <option value="">Signed off by…</option>
              {teamMembers.map((member) => (
                <option key={member._id} value={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
            <Button
              disabled={
                !allStepsComplete || !signOffMember || saving === "signoff"
              }
              className="mt-4 h-12 w-full bg-[#ffde56] text-[#171717]"
              onClick={() => void completeSignOff()}
            >
              Complete sign-off <Check className="ml-2 size-4" />
            </Button>
          </section>
        )}
        {!areaTasks.length && (
          <p className="rounded-2xl bg-white p-5 text-sm text-[#727a74]">
            No structured tasks are due here today.
          </p>
        )}
      </main>
    </div>
  );
}
