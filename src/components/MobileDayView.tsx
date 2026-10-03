/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dateFromKey } from "@/lib/date-key";

const memberLabel = (value: unknown) => typeof value === "string" && value.trim() ? value : "Not recorded";
const timeLabel = (value: unknown, timeZone: string) => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
};
const dateLabel = (dateKey: string, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateFromKey(dateKey));

function EvidenceList({ events, timeZone, empty }: any) {
  if (!events.length) return <p className="text-sm text-[#89918b]">{empty}</p>;
  return <div className="space-y-2">{events.map((event: any) => <div key={event.id} className="rounded-xl bg-[#fafbf9] p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{event.title}</p><p className="mt-1 text-[#727a74]">{event.detail}</p></div><span className={event.result === "fail" || event.result === "no" ? "shrink-0 font-semibold text-[#b64738]" : "shrink-0 font-semibold text-[#2d7951]"}>{event.result ?? "Recorded"}</span></div><p className="mt-2 text-xs text-[#89918b]">{memberLabel(event.teamMemberName)} · {timeLabel(event.occurredAt, timeZone)}</p>{event.documentUrl && <a href={event.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-[#27814f]">View certificate</a>}</div>)}</div>;
}

export default function MobileDayView({ location, date, archive, onBack }: any) {
  const timeZone = archive?.location?.timezone ?? location?.timezone ?? "Europe/London";
  const chronology = archive?.chronology ?? [];
  const by = (types: string[]) => chronology.filter((event: any) => types.includes(event.eventType));
  const summary = archive?.summary;
  const counts = summary?.counts ?? {};
  const summaryLabel = summary?.status === "complete" ? "Complete" : summary?.status === "corrective_action" ? "Corrective action recorded" : summary?.status === "future" ? "Future date" : "Incomplete";
  const issues = by(["issue_created", "issue_update", "issue_recheck", "issue_resolved"]);

  return <div className="min-h-screen bg-[#f6f7f5]">
    <header className="border-b border-black/[0.07] bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4"><Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="size-5" /></Button><div><p className="font-semibold">Daily inspection record</p><p className="text-xs text-[#89918b]">{location?.name ?? archive?.location?.name}</p></div></div></header>
    <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Day inspection</p>
      <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{dateLabel(date, timeZone)}</h1>
      <p className="mt-1 text-[#727a74]">{location?.name ?? archive?.location?.name}</p>

      <section className="mt-7 rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">Day summary</p><h2 className="mt-1 text-lg font-semibold">{summaryLabel}</h2></div>{summary?.complete ? <CheckCircle2 className="size-5 text-[#2d7951]" /> : <span className="rounded-full bg-[#f6f7f5] px-3 py-1 text-xs font-semibold text-[#727a74]">Evidence recorded</span>}</div>{summary?.carriedOpenIssueCount ? <p className="mt-3 text-sm text-[#8f3a31]">{summary.carriedOpenIssueCount} open issue{summary.carriedOpenIssueCount === 1 ? "" : "s"} carried into this day.</p> : null}<div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#727a74] sm:grid-cols-4">{[["Temperatures", counts.temperatureReadings], ["Food probes", counts.foodProbes], ["Checklist", counts.checklistResponses], ["Security", counts.securityResponses], ["Cleaning", counts.cleaningCompletions], ["Wastage", counts.wastageRecords], ["Additional", counts.additionalChecks], ["Issue events", counts.issueEvents]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[#fafbf9] p-3"><p>{label}</p><p className="mt-1 text-lg font-semibold text-[#202522]">{value ?? 0}</p></div>)}</div></section>

      <section className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Inspection chronology</h2><p className="mt-1 text-sm text-[#89918b]">Oldest to newest · recorded times are shown in the store timezone.</p><div className="mt-4 space-y-3">{chronology.length ? chronology.map((event: any) => <article key={event.id} className="rounded-xl border border-black/[0.06] bg-[#fafbf9] p-4"><div className="flex items-start gap-3"><time className="w-12 shrink-0 pt-0.5 text-sm font-semibold text-[#727a74]">{timeLabel(event.occurredAt, timeZone)}</time><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{event.title}</h3>{event.result && <span className={event.result === "fail" || event.result === "no" ? "font-semibold text-[#b64738]" : "font-semibold text-[#2d7951]"}>{event.result}</span>}</div><p className="mt-1 text-sm text-[#727a74]">{event.detail}</p><p className="mt-2 text-xs text-[#89918b]">Recorded by {memberLabel(event.teamMemberName)}</p>{event.documentUrl && <a href={event.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#27814f]">View certificate</a>}</div></div></article>) : <p className="text-sm text-[#89918b]">No inspection activity recorded for this day.</p>}</div></section>

      <div className="mt-5 space-y-4">
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Fridge temperatures</h2><div className="mt-4"><EvidenceList events={by(["temperature_reading", "temperature_round"])} timeZone={timeZone} empty="No temperature records for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Food probes</h2><div className="mt-4"><EvidenceList events={by(["food_probe"])} timeZone={timeZone} empty="No probe records for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Opening / Closing Food Safety</h2><div className="mt-4"><EvidenceList events={by(["checklist_response", "checklist_signoff"])} timeZone={timeZone} empty="No checklist records for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Security</h2><div className="mt-4"><EvidenceList events={by(["security_response", "security_signoff"])} timeZone={timeZone} empty="No security records for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Cleaning</h2><div className="mt-4"><EvidenceList events={by(["cleaning"])} timeZone={timeZone} empty="No cleaning records for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Wastage</h2><div className="mt-4"><EvidenceList events={by(["wastage"])} timeZone={timeZone} empty="No wastage record for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Additional checks</h2><div className="mt-4"><EvidenceList events={by(["additional_check"])} timeZone={timeZone} empty="No additional checks recorded for this day." /></div></section>
        <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Corrective actions</h2><div className="mt-4"><EvidenceList events={issues} timeZone={timeZone} empty="No corrective actions recorded." />{archive?.carriedOpenIssues?.length ? <div className="mt-4 rounded-xl bg-[#fff8f6] p-4 text-sm"><p className="font-semibold">Open at start of day</p>{archive.carriedOpenIssues.map((issue: any) => <p key={issue.id} className="mt-2 text-[#727a74]">{issue.title} · {memberLabel(issue.teamMemberName)} · created {timeLabel(issue.createdAt, timeZone)}</p>)}</div> : null}</div></section>
      </div>
    </main>
  </div>;
}
