import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, CheckCircle2, X, XCircle } from "lucide-react";
import { useState } from "react";
import { issueUpdateActionLabel, selectIssueStatus, selectIssueUpdateType, type IssueStatus, type IssueUpdateSelection, type IssueUpdateType } from "./issue-detail-actions";

const timeLabel = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "Time not recorded" : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
};
const statusLabel = (value: string | undefined) => value === "monitoring" ? "Monitoring" : value === "resolved" ? "Resolved" : "Open";
const statusPresentation = (value: string | undefined) => value === "monitoring"
  ? { className: "border-[#ead797] bg-[#fff9e8] text-[#8a6513]", icon: AlertTriangle }
  : value === "resolved"
    ? { className: "border-[#bfe3c9] bg-[#effaf1] text-[#216c45]", icon: CheckCircle2 }
    : { className: "border-[#efc8c3] bg-[#fff3f1] text-[#a13d32]", icon: XCircle };

function StatusBadge({ status }: { status: string | undefined }) {
  const presentation = statusPresentation(status);
  const StatusIcon = presentation.icon;
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className="size-3.5" aria-hidden="true" />{statusLabel(status)}</span>;
}

export default function IssueDetail({ issue, teamMembers = [], onUpdate, onClose }: any) {
  const [note, setNote] = useState("");
  const [teamMemberId, setTeamMemberId] = useState("");
  const [selection, setSelection] = useState<IssueUpdateSelection>(() => ({
    updateType: "further_action",
    status: issue.status === "monitoring" ? "monitoring" : "open",
  }));
  const issueId = issue._id ?? issue.id;
  const journey = issue.updates ?? issue.journey ?? [];
  async function save() {
    if (!note.trim() || !teamMemberId) return;
    await onUpdate({ issueId, note: note.trim(), status: selection.status, updateType: selection.updateType, teamMemberId });
    setNote("");
  }
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8">
    <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Issue detail</p><h2 className="mt-2 text-2xl font-semibold">{issue.title}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close issue detail"><X /></Button></div>
    <div className="mt-6 grid gap-3 rounded-2xl bg-[#fafbf9] p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-[#89918b]">Recorded by</p><p className="mt-1 font-semibold">{issue.createdByName ?? "Staff member"}</p><p className="mt-1 text-xs text-[#727a74]">{timeLabel(issue.createdAt)}</p></div><div><p className="text-xs text-[#89918b]">Status</p><div className="mt-1"><StatusBadge status={issue.status} /></div></div><div><p className="text-xs text-[#89918b]">Original reading / failed check</p><p className="mt-1 font-semibold">{issue.originalReading ?? issue.description}</p></div><div><p className="text-xs text-[#89918b]">Immediate action</p><p className="mt-1 font-semibold">{issue.action ?? "Not yet recorded"}</p></div>{issue.status === "resolved" && <div><p className="text-xs text-[#89918b]">Resolved</p><p className="mt-1 font-semibold">{issue.resolvedByName ?? "Manager"} · {issue.resolvedAt ? timeLabel(issue.resolvedAt) : "—"}</p></div>}</div>
    <div className="mt-7"><h3 className="font-semibold">Issue journey</h3><div className="mt-3 space-y-3">{journey.map((update: any, index: number) => <div key={update._id ?? `${update.eventType}-${update.createdAt ?? update.occurredAt}-${index}`} className="rounded-xl border border-black/[0.07] p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wider text-[#89918b]">{update.updateType === "resolution" || update.eventType === "issue_resolved" ? "Resolution" : update.updateType === "manager_review" ? "Manager review" : update.eventType === "recheck" || update.eventType === "issue_recheck" ? "Recheck" : update.updateType === "immediate_action" ? "Corrective action" : "Action update"}</p><p className="text-xs text-[#89918b]">{timeLabel(update.createdAt ?? update.occurredAt)}</p></div><p className="mt-2 text-sm">{update.note ?? update.detail}</p><p className="mt-2 text-xs font-semibold text-[#727a74]">{update.createdByName ?? update.teamMemberName ?? "Staff member"} · Status: {statusLabel(update.status ?? update.result)}</p></div>)}{!journey.length && <p className="text-sm text-[#89918b]">No later updates recorded.</p>}</div></div>
    {issue.status !== "resolved" && <div className="mt-7 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-5"><p className="font-semibold text-[#8f3a31]">Manage issue</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Update type<select value={selection.updateType} onChange={(event) => setSelection(current => selectIssueUpdateType(current, event.target.value as IssueUpdateType))} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="further_action">Further action</option><option value="resolution">Resolution</option></select></label><label className="text-sm font-semibold">Status<select value={selection.status} onChange={(event) => setSelection(current => selectIssueStatus(current, event.target.value as IssueStatus))} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="open">Open</option><option value="monitoring">Monitoring</option><option value="resolved">Resolved</option></select></label></div><label className="mt-4 block text-sm font-semibold">Completed by<select value={teamMemberId} onChange={(event) => setTeamMemberId(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select team member</option>{teamMembers.map((member: any) => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label><label className="mt-4 block text-sm font-semibold">What happened?<textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] bg-white p-3" placeholder="Describe further action or how the issue was resolved" /></label><Button disabled={!note.trim() || !teamMemberId} className="mt-4 h-12 bg-[#202522] text-white" onClick={save}>{issueUpdateActionLabel(selection.updateType)} <Check className="ml-2 size-4" /></Button></div>}
  </div></div>;
}
