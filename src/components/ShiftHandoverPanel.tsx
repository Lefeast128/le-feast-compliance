import { Clock3, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TeamMember } from "@/components/dashboard/dashboard-types";
import { Button } from "@/components/ui/button";
import { restApi } from "@/lib/rest-domain";
import { getOfflineStore } from "@/lib/offline/indexeddb";
import { readOfflineSession } from "@/lib/offline/device-session";
import { subscribeOutbox } from "@/lib/offline/outbox";

export type HandoverNote = {
  id: string; locationId: string; title: string; message: string; shift: string;
  category: "information" | "action_required" | "urgent" | string; version: number;
  createdAt: string | Date; senderTeamMemberId?: string | null;
  author: { id: string; name?: string | null; email?: string | null };
  acknowledgedByMe: boolean; acknowledgedAt?: string | Date | null; acknowledgementCount: number;
  resolved: boolean; resolvedAt?: string | Date | null; resolutionNote?: string | null;
};
export type HandoverData = { notes: HandoverNote[]; unreadCount: number };

const formatTime = (value: string | Date) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pendingLabel = (state: string) => state === "conflict" ? "Needs attention: this message conflicts with a server submission." : state === "failed" ? "Delivery failed. It will be retried safely when possible." : "Pending delivery. It is saved on this device, not yet sent.";

type Props = { locationId: string; data?: HandoverData | null; userId?: string; teamMembers?: TeamMember[]; canModerate?: boolean; canResolve?: boolean; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void; morningPrompt?: number | null; onMorningPromptAction?: (action: "view" | "later") => void };

export default function ShiftHandoverPanel({ locationId, data, userId, teamMembers = [], canModerate = false, open, onOpenChange, onRefresh, morningPrompt, onMorningPromptAction }: Props) {
  const [message, setMessage] = useState("");
  const [senderId, setSenderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [readBusy, setReadBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Array<{ message: string; state: string; createdAt: string }>>([]);
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const touchStart = useRef<{ id: string; x: number } | null>(null);
  const activeMembers = teamMembers.filter(member => member._id);
  const senderKey = `mise.activeHandoverSender:${locationId}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(senderKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSenderId(stored && activeMembers.some(member => member._id === stored) ? stored : activeMembers[0]?._id ?? "");
  }, [senderKey, activeMembers]);

  const chooseSender = (value: string) => {
    setSenderId(value);
    if (typeof window !== "undefined") window.sessionStorage.setItem(senderKey, value);
  };

  useEffect(() => {
    let cancelled = false;
    const loadPending = async () => {
      try {
        const session = readOfflineSession();
        if (!session || session.locationId !== locationId) { if (!cancelled) setPendingDrafts([]); return; }
        const submissions = await getOfflineStore().list(session, ["pending", "failed", "conflict"]);
        if (!cancelled) setPendingDrafts(submissions.filter(item => item.operation === "handover-note" && item.payload.locationId === locationId).map(item => ({ message: String(item.payload.message ?? ""), state: item.state, createdAt: item.createdAt })));
      } catch { if (!cancelled) setPendingDrafts([]); }
    };
    void loadPending();
    const unsubscribe = subscribeOutbox(() => { void loadPending(); });
    return () => { cancelled = true; unsubscribe(); };
  }, [locationId]);

  const create = async () => {
    const trimmed = message.trim();
    if (!trimmed) { setError("Write a message first."); return; }
    if (!senderId) { setError("Choose the staff member sending this message."); return; }
    setBusy(true); setError(null);
    try {
      await restApi.compliance.handover.create({ locationId, message: trimmed, teamMemberId: senderId, title: "Message", shift: "Current shift", category: "information" });
      setMessage(""); onRefresh();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to send this message."); }
    finally { setBusy(false); }
  };

  const markRead = async () => {
    const unread = data?.notes.filter(note => !note.acknowledgedByMe) ?? [];
    if (!unread.length) return;
    setReadBusy(true); setError(null);
    try { await Promise.all(unread.map(note => restApi.compliance.handover.acknowledge({ noteId: note.id }))); onRefresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to mark messages as read."); }
    finally { setReadBusy(false); }
  };

  const deleteMessage = async (note: HandoverNote) => {
    if (!window.confirm("Delete this message? It will be hidden from the conversation but retained in the audit history.")) return;
    setBusy(true); setError(null);
    try { await restApi.compliance.handover.delete({ noteId: note.id }); setSwipedId(null); onRefresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete this message."); }
    finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={() => onOpenChange(!open)} aria-label={data?.unreadCount ? `Messages, ${data.unreadCount} unread` : "Open messages"} className="relative flex size-10 items-center justify-center rounded-xl text-[#202522] transition hover:bg-brand-yellow/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow">
      <MessageCircle className="size-5" aria-hidden="true" />
      {Boolean(data?.unreadCount) && <span aria-label={`${data?.unreadCount} unread`} className="absolute right-0.5 top-0.5 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#b64738] px-1 text-[10px] font-bold leading-4 text-white">{data!.unreadCount > 9 ? "9+" : data!.unreadCount}</span>}
    </button>
    {morningPrompt && !open && <div role="dialog" aria-label="Unread store messages" className="fixed inset-x-4 top-20 z-50 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_18px_60px_rgba(23,25,24,0.2)] sm:left-auto sm:right-5 sm:w-80"><p className="font-semibold">Good morning! You have {morningPrompt} unread message{morningPrompt === 1 ? "" : "s"}.</p><div className="mt-3 flex gap-2"><Button type="button" className="h-10 flex-1 rounded-xl bg-brand-yellow text-[#171717]" onClick={() => onMorningPromptAction?.("view")}>View messages</Button><Button type="button" variant="outline" className="h-10 rounded-xl" onClick={() => onMorningPromptAction?.("later")}>Later</Button></div></div>}
    {open && <section aria-label="Store messages" className="fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100vh-5.5rem-env(safe-area-inset-top))] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_18px_60px_rgba(23,25,24,0.2)] sm:left-auto sm:right-5 sm:w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918b]">mise. messages</p><h2 className="mt-1 text-lg font-bold">Your store conversation</h2></div><Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl" onClick={() => onOpenChange(false)} aria-label="Close messages"><X className="size-4" /></Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <p role="alert" className="mb-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm font-semibold text-[#a43f34]">{error}</p>}
        {Boolean(data?.unreadCount) && <Button type="button" variant="outline" disabled={readBusy} className="mb-4 h-10 w-full rounded-xl" onClick={() => void markRead()}>{readBusy ? "Marking as read…" : `Mark ${data!.unreadCount} message${data!.unreadCount === 1 ? "" : "s"} as read`}</Button>}
        <div className="space-y-4">
          {data?.notes.map(note => { const deletable = note.author.id === userId || canModerate; return <div key={note.id} className="relative overflow-hidden rounded-2xl"><div className={`relative z-10 rounded-2xl border p-3 transition-transform ${swipedId === note.id ? "-translate-x-20" : "translate-x-0"} ${note.category === "urgent" ? "border-[#efc8c3] bg-[#fff8f6]" : note.acknowledgedByMe ? "border-black/[0.07] bg-white" : "border-brand-yellow/60 bg-brand-yellow/10"}`} onTouchStart={event => { touchStart.current = { id: note.id, x: event.touches[0].clientX }; }} onTouchEnd={event => { const start = touchStart.current; touchStart.current = null; if (start?.id === note.id && start.x - event.changedTouches[0].clientX > 40 && deletable) setSwipedId(note.id); }}><p className="whitespace-pre-wrap text-sm leading-6 text-[#202522]">{note.message}</p><div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#727a74]"><span className="font-semibold text-[#4e5851]">{note.author.name || note.author.email || "Staff member"}</span><span aria-hidden="true">·</span><time dateTime={new Date(note.createdAt).toISOString()}>{formatTime(note.createdAt)}</time>{note.category === "urgent" && <span className="font-semibold text-[#a43f34]">· Urgent</span>}{deletable && <button type="button" className="font-semibold text-[#a43f34] underline" onClick={() => void deleteMessage(note)}>Delete</button>}</div></div>{deletable && <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-[#b64738]"><button type="button" className="font-semibold text-white" aria-label={`Delete message from ${note.author.name || "staff member"}`} onClick={() => void deleteMessage(note)}>Delete</button></div>}</div>; })}
          {pendingDrafts.map((draft, index) => <article key={`${draft.createdAt}-${index}`} className="rounded-2xl border border-brand-yellow/60 bg-brand-yellow/10 p-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[#202522]">{draft.message}</p><p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#856719]"><Clock3 className="size-3.5" />{pendingLabel(draft.state)}</p></article>)}
          {!data?.notes.length && !pendingDrafts.length && <p className="rounded-2xl border border-dashed border-black/[0.12] p-6 text-center text-sm text-[#727a74]">No messages yet. Start the conversation for this store.</p>}
        </div>
      </div>
      <form className="border-t border-black/[0.07] bg-white p-3" onSubmit={event => { event.preventDefault(); void create(); }}><label className="mb-2 block text-xs font-semibold text-[#4e5851]" htmlFor="handover-sender">Send as<select id="handover-sender" value={senderId} onChange={event => chooseSender(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm" disabled={!activeMembers.length}><option value="">Select staff member</option>{activeMembers.map(member => <option key={member._id} value={member._id}>{member.name}</option>)}</select></label><label htmlFor="store-message" className="sr-only">Write a message</label><div className="flex items-end gap-2"><textarea id="store-message" value={message} onChange={event => setMessage(event.target.value)} rows={2} placeholder="Write a message for the next shift…" className="min-h-12 flex-1 resize-none rounded-2xl border border-black/[0.1] bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" /><Button type="submit" disabled={busy || !message.trim() || !senderId} size="icon" className="size-12 shrink-0 rounded-2xl bg-brand-yellow text-[#171717] hover:bg-brand-yellow" aria-label={busy ? "Sending message" : "Send message"}>{busy ? <Clock3 className="size-4 animate-pulse" /> : <Send className="size-4" />}</Button></div><p className="mt-2 text-[11px] text-[#89918b]">Messages are visible to authorised staff at this store.</p></form>
    </section>}
  </>;
}
