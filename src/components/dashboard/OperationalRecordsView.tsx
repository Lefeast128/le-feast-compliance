import { CheckCircle2, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";
import type {
  DashboardData,
  StructuredTask,
  StructuredTaskResponse,
  TemperatureRound,
} from "@/components/dashboard/dashboard-types";
import { versionedChecklistResponseMatches } from "@/shared/unified-checklist";

type RecordsKind = "temperature" | "checklist" | "security" | "cleaning" | "probes" | "wastage";

type Props = {
  kind: RecordsKind;
  session?: "AM" | "PM";
  checklist?: "opening" | "closing";
  dashboard: DashboardData;
  onBack: () => void;
  onAdd?: () => void;
};

const timeLabel = (value?: number | string) => value
  ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  : null;

const responseValue = (response: StructuredTaskResponse) =>
  response.responseValue === "confirmed" ? "Confirmed" : response.responseValue;

const memberName = (dashboard: DashboardData, id?: string | null, fallback?: string | null) =>
  fallback ?? dashboard.teamMembers.find((member) => member._id === id)?.name ?? "Not recorded";

const matchingStructuredResponses = (task: StructuredTask, responses: StructuredTaskResponse[]) =>
  responses.filter((response) => response.taskId === task._id || versionedChecklistResponseMatches(task, response));

const taskResponseLine = (dashboard: DashboardData, response: StructuredTaskResponse, label?: string) => (
  <p key={response._id} className="mt-1 text-sm text-[#59625c]">
    {label ? `${label}: ` : ""}{responseValue(response)} · {memberName(dashboard, response.teamMemberId, response.teamMemberName)}{timeLabel(response.createdAt) ? ` · ${timeLabel(response.createdAt)}` : ""}
  </p>
);

const taskEvidence = (dashboard: DashboardData, task: StructuredTask, responses: StructuredTaskResponse[]) => {
  const taskResponses = matchingStructuredResponses(task, responses);
  const stepLabel = (stepId: string) => task.steps?.find((step) => step.id === stepId)?.label ?? (stepId === "simple" ? "Response" : stepId);
  return taskResponses.length
    ? taskResponses.map((response) => taskResponseLine(dashboard, response, stepLabel(response.stepId)))
    : <p className="mt-1 text-sm text-[#89918b]">No response evidence available.</p>;
};

const recordDate = (values: Array<number | string | undefined>) => {
  const first = values.find(Boolean);
  return first ? operationalDateLabel(new Date(first)) : operationalDateLabel();
};

export default function OperationalRecordsView({ kind, session, checklist, dashboard, onBack, onAdd }: Props) {
  const title = kind === "temperature"
    ? `${session} fridge temperatures`
    : kind === "checklist"
      ? `${checklist === "opening" ? "Opening" : "Closing"} checklist`
      : kind === "security"
        ? `${session} security check`
        : kind === "cleaning"
          ? "Cleaning records"
          : kind === "probes"
            ? "Food probe records"
            : "Wastage records";
  const tasks = checklist ? dashboard.structuredTasks.filter((task) => task.area === checklist) : [];
  const responses = checklist ? dashboard.structuredTaskResponses.filter((response) => response.taskArea === checklist) : [];
  const legacy = checklist ? dashboard.checklists[checklist].responses : [];
  const securityQuestions = session ? dashboard.security[session] : [];
  const securityResponses = session ? dashboard.securityResponses[session] : [];
  const securityArea = session === "AM" ? "security_am" : "security_pm";
  const securityTasks = session ? dashboard.structuredTasks.filter((task) => task.area === securityArea) : [];
  const securityStructuredResponses = session ? dashboard.structuredTaskResponses.filter((response) => response.taskArea === securityArea) : [];
  const round = session ? dashboard.rounds.find((item) => item.session === session && item.completedAt) : undefined;
  const readings = round ? dashboard.readings.filter((reading) => reading.roundId === round._id) : [];
  const cleaningTasks = dashboard.structuredTasks.filter((task) => task.area === "cleaning");
  const cleaningResponses = dashboard.structuredTaskResponses.filter((response) => response.taskArea === "cleaning");
  const checklistSignoff = checklist ? dashboard.checklistSignOffs?.find((signoff) => signoff.checklist === checklist) : undefined;
  const securitySignoff = session ? dashboard.securitySignOffs?.find((signoff) => signoff.session === session) : undefined;
  const evidenceDates = kind === "temperature"
    ? [round?.completedAt, ...readings.map((reading) => reading.createdAt)]
    : kind === "checklist"
      ? [checklistSignoff?.completedAt, ...legacy.map((response) => response.createdAt), ...responses.map((response) => response.createdAt)]
      : kind === "security"
        ? [securitySignoff?.completedAt, ...securityResponses.map((response) => response.createdAt), ...securityStructuredResponses.map((response) => response.createdAt)]
        : kind === "cleaning"
          ? [...dashboard.cleaningCompletions.map((completion) => completion.completedAt), ...cleaningResponses.map((response) => response.createdAt)]
          : [];

  return (
    <div className="min-h-screen bg-[#f6f7f5] pb-[calc(2rem+env(safe-area-inset-bottom))] text-[#171918]">
      <OperationalHeader title={title} eyebrow="Recorded evidence" date={recordDate(evidenceDates)} subtitle={`${dashboard.location.name} · Read-only records`} onBack={onBack} />
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-7 sm:px-6">
        <div className="rounded-2xl border border-[#cfe3d5] bg-[#fbfefb] p-5">
          <p className="flex items-center gap-2 font-semibold text-[#2d7951]"><CheckCircle2 className="size-5" /> Recorded check</p>
          <p className="mt-1 text-sm text-[#59625c]">Completed evidence remains read-only. Use the established repeat-check action where available.</p>
        </div>

        {kind === "temperature" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <h2 className="text-xl font-semibold">{session} temperature readings</h2>
          <p className="mt-1 text-sm text-[#727a74]">Round completed by {memberName(dashboard, round?.teamMemberId, (round as TemperatureRound & { teamMemberName?: string })?.teamMemberName)}{timeLabel(round?.completedAt) ? ` · ${timeLabel(round?.completedAt)}` : ""}</p>
          <div className="mt-4 space-y-2">{readings.map((reading, index) => {
            const equipment = dashboard.equipment.find((item) => item._id === reading.equipmentId);
            const issue = dashboard.issues.find((item) => item.sourceTemperatureReadingId === reading._id);
            return <article key={reading._id} className={`rounded-xl p-3 ${reading.result === "fail" ? "border border-[#efc8c3] bg-[#fff8f6]" : "bg-[#fafbf9]"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><span className="font-semibold">{reading.equipmentName ?? equipment?.name ?? equipment?.type ?? `Fridge ${index + 1}`}</span><span className={`font-semibold ${reading.result === "fail" ? "text-[#a13d32]" : "text-[#216c45]"}`}>{reading.temperature}°C · {reading.result === "fail" ? "Failed" : "Pass"}</span></div>
              <p className="mt-1 text-xs text-[#59625c]">Recorded by {memberName(dashboard, reading.teamMemberId, reading.teamMemberName)}{timeLabel(reading.createdAt) ? ` · ${timeLabel(reading.createdAt)}` : ""}</p>
              {issue && <p className="mt-2 text-xs font-semibold text-[#8f3a31]">Issue {issue.status}{issue.action ? ` · Corrective action: ${issue.action}` : ""}</p>}
            </article>;
          })}</div>
          {!readings.length && <p className="mt-3 text-sm text-[#89918b]">No readings found for this completed round.</p>}
        </section>}

        {kind === "checklist" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="mt-4 space-y-2">{tasks.map((task) => {
            const taskResponses = matchingStructuredResponses(task, responses);
            const legacyResponse = legacy.find((response) => versionedChecklistResponseMatches(task, response));
            return <article key={task._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{task.title}</p>{task.description && <p className="mt-1 text-sm text-[#727a74]">{task.description}</p>}{taskResponses.length ? taskEvidence(dashboard, task, responses) : legacyResponse ? <p className="mt-1 text-sm text-[#59625c]">{legacyResponse.answer} · {memberName(dashboard, legacyResponse.teamMemberId, legacyResponse.teamMemberName)}{timeLabel(legacyResponse.createdAt) ? ` · ${timeLabel(legacyResponse.createdAt)}` : ""}</p> : <p className="mt-1 text-sm text-[#89918b]">No response evidence available.</p>}</article>;
          })}</div>
          {checklistSignoff && <p className="mt-4 border-t border-black/[0.07] pt-4 text-sm text-[#59625c]">Final sign-off: {memberName(dashboard, checklistSignoff.teamMemberId, checklistSignoff.teamMemberName)}{timeLabel(checklistSignoff.completedAt) ? ` · ${timeLabel(checklistSignoff.completedAt)}` : ""}</p>}
        </section>}

        {kind === "security" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <h2 className="text-xl font-semibold">{title}</h2>
          <div className="mt-4 space-y-2">
            {securityTasks.map((task) => {
              const structured = matchingStructuredResponses(task, securityStructuredResponses);
              const legacyResponse = securityResponses.find((response) => response.questionId === task._id);
              return <article key={task._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{task.title}</p>{task.description && <p className="mt-1 text-sm text-[#727a74]">{task.description}</p>}{structured.length ? taskEvidence(dashboard, task, securityStructuredResponses) : legacyResponse ? <><p className="mt-1 text-sm text-[#59625c]">{legacyResponse.answer ?? "Answer value unavailable"} · {memberName(dashboard, legacyResponse.teamMemberId, legacyResponse.teamMemberName)}{timeLabel(legacyResponse.createdAt) ? ` · ${timeLabel(legacyResponse.createdAt)}` : ""}</p>{legacyResponse.issue && <p className="mt-2 text-xs font-semibold text-[#8f3a31]">Issue reported: {legacyResponse.issue}</p>}</> : <p className="mt-1 text-sm text-[#89918b]">No response evidence available.</p>}</article>;
            })}
            {securityQuestions.map((question) => {
              if (securityTasks.some((task) => task._id === question._id)) return null;
              const response = securityResponses.find((item) => item.questionId === question._id);
              return <article key={question._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{question.question}</p>{response ? <><p className="mt-1 text-sm text-[#59625c]">{response.answer ?? "Answer value unavailable"} · {memberName(dashboard, response.teamMemberId, response.teamMemberName)}{timeLabel(response.createdAt) ? ` · ${timeLabel(response.createdAt)}` : ""}</p>{response.issue && <p className="mt-2 text-xs font-semibold text-[#8f3a31]">Issue reported: {response.issue}</p>}</> : <p className="mt-1 text-sm text-[#89918b]">No response evidence available.</p>}</article>;
            })}
          </div>
          {securitySignoff && <p className="mt-4 border-t border-black/[0.07] pt-4 text-sm text-[#59625c]">Final sign-off: {memberName(dashboard, securitySignoff.teamMemberId, securitySignoff.teamMemberName)}{timeLabel(securitySignoff.completedAt) ? ` · ${timeLabel(securitySignoff.completedAt)}` : ""}</p>}
        </section>}

        {kind === "cleaning" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <h2 className="text-xl font-semibold">Cleaning jobs</h2>
          <div className="mt-4 space-y-2">
            {cleaningTasks.map((task) => {
              const taskResponses = matchingStructuredResponses(task, cleaningResponses);
              const completion = dashboard.cleaningCompletions.find((item) => item.taskId === task._id);
              return <article key={task._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{task.title}</p>{task.description && <p className="mt-1 text-sm text-[#727a74]">{task.description}</p>}{taskResponses.length ? taskEvidence(dashboard, task, cleaningResponses) : completion ? <p className="mt-1 text-sm text-[#59625c]">Completed · {memberName(dashboard, completion.teamMemberId, completion.teamMemberName)}{timeLabel(completion.completedAt) ? ` · ${timeLabel(completion.completedAt)}` : ""}</p> : <p className="mt-1 text-sm text-[#89918b]">No completion evidence available.</p>}</article>;
            })}
            {dashboard.cleaningCompletions.filter((completion) => !cleaningTasks.some((task) => task._id === completion.taskId)).map((completion) => <article key={completion._id ?? completion.taskId} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">Cleaning job</p><p className="mt-1 text-sm text-[#59625c]">Completed · {memberName(dashboard, completion.teamMemberId, completion.teamMemberName)}{timeLabel(completion.completedAt) ? ` · ${timeLabel(completion.completedAt)}` : ""}</p></article>)}
          </div>
          {!cleaningTasks.length && !dashboard.cleaningCompletions.length && <p className="mt-3 text-sm text-[#89918b]">No cleaning completion evidence found.</p>}
        </section>}

        {kind === "probes" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Food probe records</h2><p className="mt-1 text-sm text-[#727a74]">Existing readings remain recorded. Add a new legitimate check if required.</p></div>{onAdd && <Button type="button" onClick={onAdd} className="shrink-0 bg-[#ffde56] text-[#171717]"><Plus className="mr-1 size-4" /> New check</Button>}</div><div className="mt-4 space-y-2">{dashboard.foodChecks.map((check) => <article key={check._id} className={`rounded-xl border p-4 ${check.result === "fail" ? "border-[#efc8c3] bg-[#fff8f6]" : "border-[#cfe3d5] bg-[#fbfefb]"}`}><p className="font-semibold">{check.product} · {check.temperature}°C</p><p className="mt-1 text-sm text-[#59625c]">{check.result === "fail" ? "Failed" : "Pass"} · {memberName(dashboard, undefined, check.teamMemberName)} · {timeLabel(check.createdAt)}</p>{check.result === "fail" && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#a13d32]"><TriangleAlert className="size-4" /> Issue reported</p>}</article>)}</div></section>}

        {kind === "wastage" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Wastage records</h2><p className="mt-1 text-sm text-[#727a74]">Existing records remain available for review.</p></div>{onAdd && <Button type="button" onClick={onAdd} className="shrink-0 bg-[#ffde56] text-[#171717]"><Plus className="mr-1 size-4" /> Add entry</Button>}</div><div className="mt-4 space-y-2">{dashboard.wastageRecords.map((record) => <article key={record._id} className="rounded-xl border border-black/[0.07] bg-[#fafbf9] p-4"><p className="font-semibold">{record.noWaste ? "No waste" : `${record.itemName ?? "Wastage"}${record.quantity ? ` · ${record.quantity}` : ""}`}</p><p className="mt-1 text-sm text-[#59625c]">{memberName(dashboard, undefined, record.teamMemberName)} · {timeLabel(record.createdAt)}</p></article>)}</div></section>}
      </main>
    </div>
  );
}
