import { Clock3, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { restApi } from "@/lib/rest-domain";
import { getOfflineStore } from "@/lib/offline/indexeddb";
import { readOfflineSession } from "@/lib/offline/device-session";
import { subscribeOutbox } from "@/lib/offline/outbox";

export type HandoverNote = {
  id: string;
  locationId: string;
  title: string;
  message: string;
  shift: string;
  category: "information" | "action_required" | "urgent" | string;
  version: number;
  createdAt: string | Date;
  author: { id: string; name?: string | null; email?: string | null };
  acknowledgedByMe: boolean;
  acknowledgedAt?: string | Date | null;
  acknowledgementCount: number;
  resolved: boolean;
  resolvedAt?: string | Date | null;
  resolutionNote?: string | null;
};

export type HandoverData = { notes: HandoverNote[]; unreadCount: number };

const formatTime = (value: string | Date) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const pendingLabel = (state: string) => state === "conflict" ? "Needs attention: this message conflicts with a server submission." : state === "failed" ? "Delivery failed. It will be retried safely when possible." : "Pending delivery. It is saved on this device, not yet sent.";

export default function ShiftHandoverPanel({ locationId, data, open, onOpenChange, onRefresh }: { locationId: string; data?: HandoverData | null; canResolve?: boolean; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Array<{ message: string; state: string; createdAt: string }>>([]);
  const markedRead = useRef(new Set<string>());

  useEffect(() => { markedRead.current.clear(); }, [locationId]);

  useEffect(() => {
    if (!open || !data?.notes.length) return;
    const unread = data.notes.filter(note => !note.acknowledgedByMe && !markedRead.current.has(note.id));
    if (!unread.length) return;
    unread.forEach(note => markedRead.current.add(note.id));
    void Promise.allSettled(unread.map(note => restApi.compliance.handover.acknowledge({ noteId: note.id }))).then(onRefresh);
  }, [data?.notes, onRefresh, open]);

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
    setBusy(true); setError(null);
    try {
      await restApi.compliance.handover.create({ locationId, message: trimmed, title: "Message", shift: "Current shift", category: "information" });
      setMessage("");
      onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to send this message.");
    } finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={() => onOpenChange(!open)} aria-label={data?.unreadCount ? `Messages, ${data.unreadCount} unread` : "Open messages"} className="relative flex size-10 items-center justify-center rounded-xl text-[#202522] transition hover:bg-brand-yellow/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow">
      <MessageCircle className="size-5" aria-hidden="true" />
      {Boolean(data?.unreadCount) && <span aria-label={`${data?.unreadCount} unread`} className="absolute right-0.5 top-0.5 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#b64738] px-1 text-[10px] font-bold leading-4 text-white">{data!.unreadCount > 9 ? "9+" : data!.unreadCount}</span>}
    </button>
    {open && <section aria-label="Store messages" className="fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100vh-5.5rem-env(safe-area-inset-top))] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_18px_60px_rgba(23,25,24,0.2)] sm:left-auto sm:right-5 sm:w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918b]">mise. messages</p><h2 className="mt-1 text-lg font-bold">{locationId ? "Your store conversation" : "Messages"}</h2></div><Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl" onClick={() => onOpenChange(false)} aria-label="Close messages"><X className="size-4" /></Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <p role="alert" className="mb-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm font-semibold text-[#a43f34]">{error}</p>}
        <div className="space-y-4">
          {data?.notes.map(note => <article key={note.id} className={`rounded-2xl border p-3 ${note.category === "urgent" ? "border-[#efc8c3] bg-[#fff8f6]" : note.acknowledgedByMe ? "border-black/[0.07] bg-white" : "border-brand-yellow/60 bg-brand-yellow/10"}`}><p className="whitespace-pre-wrap text-sm leading-6 text-[#202522]">{note.message}</p><div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#727a74]"><span className="font-semibold text-[#4e5851]">{note.author.name || note.author.email || "Staff member"}</span><span aria-hidden="true">·</span><time dateTime={new Date(note.createdAt).toISOString()}>{formatTime(note.createdAt)}</time>{note.category === "urgent" && <span className="font-semibold text-[#a43f34]">· Urgent</span>}{note.category === "action_required" && <span className="font-semibold text-[#856719]">· Action required</span>}</div></article>)}
          {pendingDrafts.map((draft, index) => <article key={`${draft.createdAt}-${index}`} className="rounded-2xl border border-brand-yellow/60 bg-brand-yellow/10 p-3"><p className="whitespace-pre-wrap text-sm leading-6 text-[#202522]">{draft.message}</p><p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#856719]"><Clock3 className="size-3.5" />{pendingLabel(draft.state)}</p></article>)}
          {!data?.notes.length && !pendingDrafts.length && <p className="rounded-2xl border border-dashed border-black/[0.12] p-6 text-center text-sm text-[#727a74]">No messages yet. Start the conversation for this store.</p>}
        </div>
      </div>
      <form className="border-t border-black/[0.07] bg-white p-3" onSubmit={event => { event.preventDefault(); void create(); }}><label htmlFor="store-message" className="sr-only">Write a message</label><div className="flex items-end gap-2"><textarea id="store-message" value={message} onChange={event => setMessage(event.target.value)} rows={2} placeholder="Write a message for the next shift…" className="min-h-12 flex-1 resize-none rounded-2xl border border-black/[0.1] bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" /><Button type="submit" disabled={busy || !message.trim()} size="icon" className="size-12 shrink-0 rounded-2xl bg-brand-yellow text-[#171717] hover:bg-brand-yellow" aria-label={busy ? "Sending message" : "Send message"}>{busy ? <Clock3 className="size-4 animate-pulse" /> : <Send className="size-4" />}</Button></div><p className="mt-2 text-[11px] text-[#89918b]">Messages are visible to authorised staff at this store.</p></form>
    </section>}
  </>;
}
