import { ArrowLeft, CheckCircle2, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DashboardData, StructuredTask, TemperatureRound } from "@/components/dashboard/dashboard-types";
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
type SecurityRecord = { questionId: string; answer?: string; responseValue?: string; teamMemberId?: string; teamMemberName?: string };

const memberName = (dashboard: DashboardData, id?: string | null, fallback?: string | null) =>
  fallback ?? dashboard.teamMembers.find((member) => member._id === id)?.name ?? "Not recorded";

export default function OperationalRecordsView({ kind, session, checklist, dashboard, onBack, onAdd }: Props) {
  const title = kind === "temperature" ? `${session} fridge temperatures` : kind === "checklist" ? `${checklist === "opening" ? "Opening" : "Closing"} checklist` : kind === "security" ? `${session} security check` : kind === "cleaning" ? "Cleaning records" : kind === "probes" ? "Food probe records" : "Wastage records";
  const tasks = checklist ? dashboard.structuredTasks.filter((task) => task.area === checklist) : [];
  const responses = checklist ? dashboard.structuredTaskResponses.filter((response) => response.taskArea === checklist) : [];
  const legacy = checklist ? dashboard.checklists[checklist].responses : [];
  const securityQuestions = session ? dashboard.security[session] : [];
  const securityResponses = session ? dashboard.securityResponses[session] as SecurityRecord[] : [];
  const round = session ? dashboard.rounds.find((item) => item.session === session && item.completedAt) : undefined;
  const readings = round ? dashboard.readings.filter((reading) => reading.roundId === round._id) : [];

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to daily checks"><ArrowLeft className="size-5" /></Button>
          <div><p className="font-semibold">{title}</p><p className="text-xs text-[#89918b]">{dashboard.location.name} · Recorded today</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-3 px-4 py-7 sm:px-6">
        <div className="rounded-2xl border border-[#cfe3d5] bg-[#fbfefb] p-5">
          <p className="flex items-center gap-2 font-semibold text-[#2d7951]"><CheckCircle2 className="size-5" /> Recorded check</p>
          <p className="mt-1 text-sm text-[#59625c]">Completed evidence remains read-only. Use the established repeat-check action where available.</p>
        </div>

        {kind === "temperature" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h1 className="text-xl font-semibold">{session} temperature readings</h1><p className="mt-1 text-sm text-[#727a74]">Completed by {memberName(dashboard, round?.teamMemberId, (round as TemperatureRound & { teamMemberName?: string })?.teamMemberName)}</p><div className="mt-4 space-y-2">{readings.map((reading) => <div key={reading._id} className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-3"><span>Fridge reading</span><span className={`font-semibold ${reading.result === "fail" ? "text-[#a13d32]" : "text-[#216c45]"}`}>{reading.temperature}°C · {reading.result === "fail" ? "Failed" : "Pass"}</span></div>)}</div>{!readings.length && <p className="mt-3 text-sm text-[#89918b]">No readings found for this completed round.</p>}</section>}

        {kind === "checklist" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h1 className="text-xl font-semibold">{title}</h1><div className="mt-4 space-y-2">{tasks.map((task: StructuredTask) => { const taskResponses = responses.filter((response) => response.taskId === task._id || versionedChecklistResponseMatches(task, response)); const legacyResponse = legacy.find((response) => versionedChecklistResponseMatches(task, response)); return <article key={task._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{task.title}</p>{taskResponses.map((response) => <p key={response._id} className="mt-1 text-sm text-[#59625c]">{response.responseValue} · {memberName(dashboard, response.teamMemberId, response.teamMemberName)}{response.createdAt ? ` · ${new Date(response.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>)}{legacyResponse && <p className="mt-1 text-sm text-[#59625c]">{legacyResponse.answer} · {memberName(dashboard, legacyResponse.teamMemberId, legacyResponse.teamMemberName)}{legacyResponse.createdAt ? ` · ${new Date(legacyResponse.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</p>}</article>; })}</div></section>}

        {kind === "security" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h1 className="text-xl font-semibold">{title}</h1><div className="mt-4 space-y-2">{securityQuestions.map((question) => { const response = securityResponses.find((item) => item.questionId === question._id); return <article key={question._id} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{question.question}</p><p className="mt-1 text-sm text-[#59625c]">{response?.answer ?? response?.responseValue ?? "Recorded"} · {memberName(dashboard, response?.teamMemberId, response?.teamMemberName)}</p></article>; })}</div></section>}

        {kind === "cleaning" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h1 className="text-xl font-semibold">Cleaning jobs</h1><div className="mt-4 space-y-2">{dashboard.cleaningCompletions.map((completion) => <article key={completion._id ?? completion.taskId} className="rounded-xl border border-[#cfe3d5] bg-[#fbfefb] p-4"><p className="font-semibold">{dashboard.cleaningTasks.find((task) => task._id === completion.taskId)?.name ?? "Cleaning job"}</p><p className="mt-1 text-sm text-[#59625c]">Completed · {memberName(dashboard, undefined, completion.teamMemberName)}{completion.completedAt ? ` · ${new Date(completion.completedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</p></article>)}</div></section>}

        {kind === "probes" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Food probe records</h1><p className="mt-1 text-sm text-[#727a74]">Existing readings remain recorded. Add a new legitimate check if required.</p></div>{onAdd && <Button type="button" onClick={onAdd} className="shrink-0 bg-[#ffde56] text-[#171717]"><Plus className="mr-1 size-4" /> New check</Button>}</div><div className="mt-4 space-y-2">{dashboard.foodChecks.map((check) => <article key={check._id} className={`rounded-xl border p-4 ${check.result === "fail" ? "border-[#efc8c3] bg-[#fff8f6]" : "border-[#cfe3d5] bg-[#fbfefb]"}`}><p className="font-semibold">{check.product} · {check.temperature}°C</p><p className="mt-1 text-sm text-[#59625c]">{check.result === "fail" ? "Failed" : "Pass"} · {memberName(dashboard, undefined, check.teamMemberName)} · {new Date(check.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p>{check.result === "fail" && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[#a13d32]"><TriangleAlert className="size-4" /> Issue reported</p>}</article>)}</div></section>}

        {kind === "wastage" && <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h1 className="text-xl font-semibold">Wastage records</h1><p className="mt-1 text-sm text-[#727a74]">Existing records remain available for review.</p></div>{onAdd && <Button type="button" onClick={onAdd} className="shrink-0 bg-[#ffde56] text-[#171717]"><Plus className="mr-1 size-4" /> Add entry</Button>}</div><div className="mt-4 space-y-2">{dashboard.wastageRecords.map((record) => <article key={record._id} className="rounded-xl border border-black/[0.07] bg-[#fafbf9] p-4"><p className="font-semibold">{record.noWaste ? "No waste" : `${record.itemName ?? "Wastage"}${record.quantity ? ` · ${record.quantity}` : ""}`}</p><p className="mt-1 text-sm text-[#59625c]">{memberName(dashboard, undefined, record.teamMemberName)} · {new Date(record.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p></article>)}</div></section>}
      </main>
    </div>
  );
}
