/* eslint-disable @typescript-eslint/no-explicit-any */
import { ArrowLeft, CheckCircle2, ChevronRight, FileWarning } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import IssueJourneyDialog from "@/components/IssueJourneyDialog";
import { dateFromKey } from "@/lib/date-key";
import { resultLabel } from "@/lib/temperature-resolution";

const memberLabel = (value: unknown) => typeof value === "string" && value.trim() ? value : "Not recorded";
const timeLabel = (value: unknown, timeZone: string) => {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" }).format(date);
};
const dateLabel = (dateKey: string, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(dateFromKey(dateKey));
const responseLabel = (value: unknown) => value === "fail" ? "Failed" : value === "no" ? "No" : value === "pass" || value === "normal" || value === "within_limit" ? "Pass" : resultLabel(value as string);
const responseTone = (value: unknown) => value === "fail" || value === "no" ? "red" : value === "monitoring" ? "amber" : "green";

function EvidenceList({ events, timeZone, empty }: any) {
  if (!events.length) return <p className="text-sm text-[#89918b]">{empty}</p>;
  return (
    <div className="space-y-2">
      {events.map((event: any) => {
        const tone = responseTone(event.result);
        return (
          <div key={event.id} className="rounded-xl border border-black/[0.06] bg-[#fafbf9] p-4 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{event.title}</p>
                <p className="mt-1 leading-6 text-[#727a74]">{event.detail}</p>
              </div>
              <span className={`shrink-0 font-semibold ${tone === "red" ? "text-[#a13d32]" : tone === "amber" ? "text-[#8a6513]" : "text-[#216c45]"}`}>
                {responseLabel(event.result)}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#89918b]">{memberLabel(event.teamMemberName)} · {timeLabel(event.occurredAt, timeZone)}</p>
            {event.documentUrl && <a href={event.documentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-semibold text-[#27814f]">View certificate</a>}
          </div>
        );
      })}
    </div>
  );
}

function IssueSummary({ issue, updates, timeZone, onOpen }: any) {
  const action = [...updates].reverse().find((update: any) => update.updateType === "immediate_action" || update.updateType === "action" || update.updateType === "further_action");
  const tone = issue.status === "resolved" ? "green" : issue.status === "monitoring" ? "amber" : "red";
  const label = issue.status === "resolved" ? "Resolved" : issue.status === "monitoring" ? "Monitoring" : "Open";
  return (
    <article className="rounded-xl border border-black/[0.06] bg-[#fafbf9] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">{issue.category}</p>
          <h3 className="mt-1 font-semibold">{issue.title}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone === "green" ? "bg-[#e7f5eb] text-[#216c45]" : tone === "amber" ? "bg-[#fff1c7] text-[#8a6513]" : "bg-[#ffe3df] text-[#a13d32]"}`}>
          {label}
        </span>
      </div>
      {issue.originalReading && <p className="mt-3 text-sm font-semibold text-[#a13d32]">Original reading: {issue.originalReading} · Failed</p>}
      <p className="mt-2 text-sm text-[#727a74]">{action ? `Corrective action: ${action.note}` : "Corrective action not recorded"}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#89918b]">Reported by {memberLabel(issue.teamMemberName)} · {timeLabel(issue.createdAt, timeZone)}</p>
        <Button variant="outline" size="sm" onClick={onOpen}>View issue journey <ChevronRight className="ml-1 size-4" /></Button>
      </div>
    </article>
  );
}

export default function MobileDayView({ location, date, archive, onBack }: any) {
  const timeZone = archive?.location?.timezone ?? location?.timezone ?? "Europe/London";
  const chronology = archive?.chronology ?? [];
  const by = (types: string[]) => chronology.filter((event: any) => types.includes(event.eventType));
  const summary = archive?.summary;
  const counts = summary?.counts ?? {};
  const summaryLabel = summary?.complete ? "Complete" : summary?.status === "future" ? "Future date" : "Incomplete";
  const issues = archive?.issues ?? [];
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const issueForReading = (reading: any) => issues.find((issue: any) => issue.id === (reading.relatedIssueId ?? issues.find((item: any) => item.sourceTemperatureReadingId === reading.id)?.id));
  const openIssue = (issue: any) => issue && setSelectedIssue({ ...issue, journey: chronology.filter((event: any) => event.relatedIssueId === issue.id) });
  const rounds = (archive?.rounds ?? []).filter((round: any) => (archive?.readings ?? []).some((reading: any) => reading.roundId === (round.id ?? round._id)));
  const updatesFor = (issueId: string) => (archive?.issueUpdates ?? []).filter((update: any) => update.issueId === issueId);
  const dayIssueIds = new Set(chronology.map((event: any) => event.relatedIssueId).filter(Boolean));
  const dayIssues = issues.filter((issue: any) => dayIssueIds.has(issue.id));

  return (
    <div className="min-h-screen bg-[#f6f7f5]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to calendar"><ArrowLeft className="size-5" /></Button>
          <div><p className="font-semibold">Daily inspection record</p><p className="text-xs text-[#89918b]">{location?.name ?? archive?.location?.name}</p></div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Day inspection</p>
        <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{dateLabel(date, timeZone)}</h1>
        <p className="mt-1 text-[#727a74]">{location?.name ?? archive?.location?.name}</p>

        <section className="mt-7 rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">Day summary</p><h2 className="mt-1 text-lg font-semibold">{summaryLabel}</h2>{summary?.correctiveActionRecorded && <p className="mt-2 text-sm font-semibold text-[#8a6513]">Corrective action recorded</p>}</div>
            {summary?.complete ? <CheckCircle2 className="size-5 text-[#2d7951]" /> : <span className="rounded-full bg-[#f6f7f5] px-3 py-1 text-xs font-semibold text-[#727a74]">Evidence recorded</span>}
          </div>
          {summary?.carriedOpenIssueCount ? <p className="mt-3 text-sm text-[#8f3a31]">{summary.carriedOpenIssueCount} open issue{summary.carriedOpenIssueCount === 1 ? "" : "s"} carried into this day.</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[#727a74] sm:grid-cols-4">
            {[["Temperatures", counts.temperatureReadings], ["Food probes", counts.foodProbes], ["Checklist", counts.checklistResponses], ["Security", counts.securityResponses], ["Cleaning", counts.cleaningCompletions], ["Wastage", counts.wastageRecords], ["Additional", counts.additionalChecks], ["Issue events", counts.issueEvents]].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-[#fafbf9] p-3"><p>{label}</p><p className="mt-1 text-lg font-semibold text-[#202522]">{value ?? 0}</p></div>)}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Fridge temperatures</h2><p className="mt-1 text-sm text-[#89918b]">All recorded readings, grouped by temperature round.</p></div></div>
          <div className="mt-4 space-y-4">
            {rounds.length ? rounds.map((round: any) => {
              const roundId = round.id ?? round._id;
              const readings = (archive.readings ?? []).filter((reading: any) => reading.roundId === roundId);
              return (
                <article key={roundId} className="rounded-2xl border border-black/[0.07] bg-[#fafbf9] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><h3 className="font-semibold">{round.session} Fridge Temperatures</h3><p className="mt-1 text-sm text-[#727a74]">{timeLabel(round.startedAt, timeZone)} · Completed by {memberLabel(round.teamMemberName)}</p></div>
                    <span className={round.completedAt ? "rounded-full bg-[#e7f5eb] px-3 py-1 text-xs font-semibold text-[#2d7951]" : "rounded-full bg-[#fff8f6] px-3 py-1 text-xs font-semibold text-[#a13d32]"}>{round.completedAt ? "Round complete" : "Incomplete"}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {readings.map((reading: any) => {
                      const issue = issueForReading(reading);
                      return <div key={reading.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3"><div><p className="text-base font-semibold">{reading.equipmentName ?? "Fridge"} · <span className="text-lg">{reading.temperature}°C</span></p><p className={`mt-1 text-xs font-semibold ${reading.result === "fail" ? "text-[#a13d32]" : "text-[#216c45]"}`}>{responseLabel(reading.result)} · {memberLabel(reading.teamMemberName)} · {timeLabel(reading.createdAt, timeZone)}</p>{issue && <p className="mt-1 text-xs text-[#727a74]">Issue: {resultLabel(issue.status)}</p>}</div>{issue && <Button variant="outline" size="sm" onClick={() => openIssue(issue)}>View issue journey <ChevronRight className="ml-1 size-4" /></Button>}</div>;
                    })}
                  </div>
                </article>
              );
            }) : <p className="text-sm text-[#89918b]">No temperature records for this day.</p>}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5">
          <h2 className="text-lg font-semibold">Food probe temperatures</h2>
          <p className="mt-1 text-sm text-[#89918b]">All recorded probe readings, including passing checks.</p>
          <div className="mt-4"><EvidenceList events={by(["food_probe"])} timeZone={timeZone} empty="No probe records for this day." /></div>
        </section>

        <div className="mt-5 space-y-4">
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Opening / Closing Food Safety</h2><div className="mt-4"><EvidenceList events={by(["checklist_response", "checklist_signoff"])} timeZone={timeZone} empty="No checklist records for this day." /></div></section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Security</h2><div className="mt-4"><EvidenceList events={by(["security_response", "security_signoff"])} timeZone={timeZone} empty="No security records for this day." /></div></section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Cleaning</h2><div className="mt-4"><EvidenceList events={by(["cleaning"])} timeZone={timeZone} empty="No cleaning records for this day." /></div></section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Wastage</h2><div className="mt-4"><EvidenceList events={by(["wastage"])} timeZone={timeZone} empty="No wastage record for this day." /></div></section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><h2 className="text-lg font-semibold">Additional checks</h2><div className="mt-4"><EvidenceList events={by(["additional_check"])} timeZone={timeZone} empty="No additional checks recorded for this day." /></div></section>
          <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Issues &amp; Actions</h2><p className="mt-1 text-sm text-[#89918b]">Current issue status and the recorded immediate action.</p></div><FileWarning className="size-5 text-[#89918b]" /></div>
            <div className="mt-4 space-y-3">
              {dayIssues.length ? dayIssues.map((issue: any) => <IssueSummary key={issue.id} issue={issue} updates={updatesFor(issue.id)} timeZone={timeZone} onOpen={() => openIssue(issue)} />) : <p className="text-sm text-[#89918b]">No issues recorded for this day.</p>}
              {archive?.carriedOpenIssues?.length ? <div className="rounded-xl bg-[#fff8f6] p-4 text-sm"><p className="font-semibold">Open at start of day</p>{archive.carriedOpenIssues.map((issue: any) => <p key={issue.id} className="mt-2 text-[#727a74]">{issue.title} · {memberLabel(issue.teamMemberName)} · created {timeLabel(issue.createdAt, timeZone)}</p>)}</div> : null}
            </div>
          </section>
        </div>

        <details className="rounded-2xl border border-black/[0.07] bg-white p-5">
          <summary className="cursor-pointer text-lg font-semibold">Detailed inspection chronology</summary>
          <p className="mt-1 text-sm text-[#89918b]">Full audit detail is available when needed; the grouped evidence above is the primary inspection view.</p>
          <div className="mt-4">{chronology.length ? <div className="space-y-3">{chronology.map((event: any) => <article key={event.id} className="rounded-xl border border-black/[0.06] bg-[#fafbf9] p-4"><div className="flex items-start gap-3"><time className="w-12 shrink-0 pt-0.5 text-sm font-semibold text-[#727a74]">{timeLabel(event.occurredAt, timeZone)}</time><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{event.title}</h3>{event.result && <span className={`font-semibold ${event.result === "fail" || event.result === "no" ? "text-[#a13d32]" : "text-[#216c45]"}`}>{responseLabel(event.result)}</span>}</div><p className="mt-1 text-sm text-[#727a74]">{event.detail}</p><p className="mt-2 text-xs text-[#89918b]">Recorded by {memberLabel(event.teamMemberName)}</p></div></div></article>)}</div> : <p className="text-sm text-[#89918b]">No inspection activity recorded for this day.</p>}</div>
        </details>
      </main>
      {selectedIssue && <IssueJourneyDialog issue={selectedIssue} timeZone={timeZone} onClose={() => setSelectedIssue(null)} />}
    </div>
  );
}
