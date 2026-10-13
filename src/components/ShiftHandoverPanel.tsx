import { AlertTriangle, Check, Clock3, MessageCircle, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
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

const categoryLabel = (category: string) => category === "action_required" ? "Action required" : category.charAt(0).toUpperCase() + category.slice(1);
const categoryClass = (category: string) => category === "urgent" ? "border-[#efc8c3] bg-[#fff8f6] text-[#a43f34]" : category === "action_required" ? "border-[#f0d98b] bg-[#fffdf4] text-[#856719]" : "border-black/[0.08] bg-white text-[#59625c]";
const formatTime = (value: string | Date) => new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ShiftHandoverPanel({ locationId, data, canResolve, open, onOpenChange, onRefresh }: { locationId: string; data?: HandoverData | null; canResolve: boolean; open: boolean; onOpenChange: (open: boolean) => void; onRefresh: () => void }) {
  const [showComposer, setShowComposer] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [shift, setShift] = useState("Current shift");
  const [category, setCategory] = useState("information");
  const [resolutionNote, setResolutionNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Array<{ title: string; message: string; category: string; shift: string; state: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    const loadPending = async () => {
      try {
        const session = readOfflineSession();
        if (!session || session.locationId !== locationId) { if (!cancelled) setPendingDrafts([]); return; }
        const submissions = await getOfflineStore().list(session, ["pending", "failed", "conflict"]);
        if (!cancelled) setPendingDrafts(submissions.filter(item => item.operation === "handover-note" && item.payload.locationId === locationId).map(item => ({
          title: String(item.payload.title ?? "Untitled handover note"), message: String(item.payload.message ?? ""), category: String(item.payload.category ?? "information"), shift: String(item.payload.shift ?? "Current shift"), state: item.state,
        })));
      } catch {
        // Offline storage can be unavailable; the online note list remains usable.
      }
    };
    void loadPending();
    const unsubscribe = subscribeOutbox(() => { void loadPending(); });
    return () => { cancelled = true; unsubscribe(); };
  }, [locationId]);

  const create = async () => {
    setError(null);
    if (!title.trim() || !message.trim()) { setError("Add a subject and message first."); return; }
    setBusy("create");
    try {
      const result = await restApi.compliance.handover.create({ locationId, title, message, shift, category });
      if (result?.state === "pending") setPendingDrafts(current => [{ title, message, shift, category, state: "pending" }, ...current]);
      setTitle(""); setMessage(""); setShowComposer(false); onRefresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to post this handover note.");
    } finally { setBusy(null); }
  };

  const acknowledge = async (noteId: string) => {
    setBusy(`ack:${noteId}`); setError(null);
    try { await restApi.compliance.handover.acknowledge({ noteId }); onRefresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to acknowledge this note."); }
    finally { setBusy(null); }
  };

  const resolve = async (noteId: string) => {
    const note = resolutionNote[noteId]?.trim();
    if (!note) { setError("Add a short resolution note before closing an action."); return; }
    setBusy(`resolve:${noteId}`); setError(null);
    try { await restApi.compliance.handover.resolve({ noteId, resolutionNote: note }); onRefresh(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to resolve this action."); }
    finally { setBusy(null); }
  };
  const toggleOpen = () => {
    if (open) setShowComposer(false);
    onOpenChange(!open);
  };
  const close = () => {
    setShowComposer(false);
    onOpenChange(false);
  };

  return <>
    <button type="button" onClick={toggleOpen} aria-label={data?.unreadCount ? `Shift handover, ${data.unreadCount} unread` : "Shift handover"} className="relative flex size-10 items-center justify-center rounded-xl text-[#202522] transition hover:bg-brand-yellow/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow">
      <MessageCircle className="size-5" aria-hidden="true" />
      {Boolean(data?.unreadCount) && <span aria-label={`${data?.unreadCount} unread`} className="absolute right-0.5 top-0.5 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#b64738] px-1 text-[10px] font-bold leading-4 text-white">{data!.unreadCount > 9 ? "9+" : data!.unreadCount}</span>}
    </button>
    {open && <section aria-label="Shift handover" className="fixed inset-x-3 top-[calc(4rem+env(safe-area-inset-top))] z-40 max-h-[calc(100vh-5rem-env(safe-area-inset-top))] overflow-y-auto rounded-3xl border border-black/[0.08] bg-white p-4 shadow-[0_18px_60px_rgba(23,25,24,0.2)] sm:left-auto sm:right-5 sm:w-[min(28rem,calc(100vw-2rem))]">
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] pb-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918b]">Shift handover</p><h2 className="mt-1 text-lg font-bold">Messages for this store</h2></div><Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl" onClick={close} aria-label="Close shift handover"><X className="size-4" /></Button></div>
      {error && <p role="alert" className="mt-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm font-semibold text-[#a43f34]">{error}</p>}
      <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs text-[#727a74]">Unread notes stay here until you acknowledge them.</p><Button type="button" size="sm" className="shrink-0 bg-brand-yellow text-[#171717] hover:bg-brand-yellow" onClick={() => setShowComposer(value => !value)}>{showComposer ? "Cancel" : "New note"}</Button></div>
      {showComposer && <div className="mt-3 rounded-2xl border border-black/[0.08] bg-[#fffdf4] p-3"><label className="text-xs font-semibold text-[#59625c]">Subject<input value={title} onChange={event => setTitle(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" /></label><label className="mt-3 block text-xs font-semibold text-[#59625c]">Message<textarea value={message} onChange={event => setMessage(event.target.value)} rows={3} className="mt-1 w-full resize-none rounded-xl border border-black/[0.1] bg-white p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow" /></label><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[#59625c]">Shift<select value={shift} onChange={event => setShift(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-2 text-sm"><option>Current shift</option><option>Opening</option><option>Closing</option><option>Overnight</option></select></label><label className="text-xs font-semibold text-[#59625c]">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-2 text-sm"><option value="information">Information</option><option value="action_required">Action required</option><option value="urgent">Urgent</option></select></label></div><Button type="button" disabled={busy === "create"} onClick={() => void create()} className="mt-3 h-11 w-full bg-brand-yellow text-[#171717] hover:bg-brand-yellow">{busy === "create" ? "Saving…" : "Post handover note"}<Send className="ml-2 size-4" /></Button></div>}
      {pendingDrafts.length > 0 && <div className="mt-3 space-y-2"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#856719]">Pending delivery</p>{pendingDrafts.map((draft, index) => <div key={`${draft.title}-${index}`} className="rounded-2xl border border-[#f0d98b] bg-[#fffdf4] p-3 text-sm"><div className="flex items-center gap-2 font-semibold"><Clock3 className="size-4 text-[#856719]" />{draft.title}</div><p className="mt-1 text-xs text-[#727a74]">{draft.state === "conflict" ? "Needs attention: the server found a conflicting submission." : draft.state === "failed" ? "Delivery failed. It will remain here until it can be retried safely." : "Saved on this device. It will be delivered when the connection returns."}</p></div>)}</div>}
      <div className="mt-4 space-y-3">{data?.notes.length ? data.notes.map(note => <article key={note.id} className={`rounded-2xl border p-3 ${note.acknowledgedByMe ? "border-black/[0.07] bg-white" : "border-brand-yellow/60 bg-[#fffdf4]"}`}><div className="flex items-start justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><span className={`rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${categoryClass(note.category)}`}>{note.category === "urgent" && <AlertTriangle className="mr-1 inline size-3" />}{categoryLabel(note.category)}</span>{!note.acknowledgedByMe && <span className="rounded-full bg-brand-yellow px-2 py-0.5 text-[10px] font-bold text-[#202522]">Unread</span>}</div><span className="shrink-0 text-[11px] text-[#89918b]">{formatTime(note.createdAt)}</span></div><h3 className="mt-3 font-bold">{note.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-[#4e5851]">{note.message}</p><p className="mt-3 text-xs text-[#89918b]">{note.author.name || note.author.email || "Staff member"} · {note.shift}</p><div className="mt-3 flex flex-wrap items-center gap-2">{note.acknowledgedByMe ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d7951]"><Check className="size-4" />Read</span> : <Button type="button" size="sm" variant="outline" disabled={busy === `ack:${note.id}`} onClick={() => void acknowledge(note.id)}>{busy === `ack:${note.id}` ? "Saving…" : "Acknowledge"}</Button>}{note.category === "action_required" && !note.resolved && canResolve && <div className="flex min-w-[min(100%,18rem)] flex-1 gap-2"><input aria-label={`Resolution note for ${note.title}`} value={resolutionNote[note.id] ?? ""} onChange={event => setResolutionNote(current => ({ ...current, [note.id]: event.target.value }))} placeholder="Resolution note" className="h-9 min-w-0 flex-1 rounded-lg border border-black/[0.1] px-2 text-xs" /><Button type="button" size="sm" disabled={busy === `resolve:${note.id}`} onClick={() => void resolve(note.id)} className="bg-brand-yellow text-[#171717] hover:bg-brand-yellow">Resolve</Button></div>}{note.resolved && <span className="text-xs font-semibold text-[#2d7951]">Action resolved{note.resolutionNote ? ` · ${note.resolutionNote}` : ""}</span>}</div></article>) : <p className="rounded-2xl border border-dashed border-black/[0.12] p-5 text-center text-sm text-[#727a74]">No handover notes for this store yet.</p>}</div>
    </section>}
  </>;
}
