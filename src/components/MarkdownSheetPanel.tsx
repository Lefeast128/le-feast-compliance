/* eslint-disable react-hooks/set-state-in-effect */
import { ClipboardList, Minus, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TeamMember } from "@/components/dashboard/dashboard-types";
import { Button } from "@/components/ui/button";
import { ActiveStaffControl } from "@/components/dashboard/StaffAttribution";
import { useActiveTeamMember } from "@/hooks/use-active-team-member";
import { restApi } from "@/lib/rest-domain";

type Product = { id?: string; _id?: string; name: string; plu?: number; markdownProductId?: string; catalogueProductId?: string; wastageItemId?: string };
type Item = { dateKey?: string; id: string; productId: string; productName: string; mode: "use" | "reduce"; quantity: number; completedAt?: string | null; completedTeamMemberId?: string | null };
type SheetData = { products: Product[]; catalogue: Product[]; items: Item[]; reminder: { dateKey: string; count: number; items: Item[] } | null };
type Props = { locationId: string; locationName: string; timeZone?: string; teamMembers: TeamMember[]; canManageProducts?: boolean };

const localDateKey = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
};
const idOf = (value: Product) => value.markdownProductId ?? value._id ?? value.id ?? "";
const makeKey = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") : `${Date.now()}${Math.random().toString(36).slice(2)}`;

export default function MarkdownSheetPanel({ locationId, locationName, timeZone = "Europe/London", teamMembers, canManageProducts = false }: Props) {
  const dateKey = localDateKey(timeZone);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"view" | "add">("view");
  const [data, setData] = useState<SheetData | null>(null);
  const [senderId, setSenderId] = useActiveTeamMember(locationId, teamMembers);
  const [showOutstanding, setShowOutstanding] = useState(false);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"use" | "reduce">("use");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState("");

  const load = async () => {
    try { setData(await restApi.compliance.markdownSheet.list({ locationId, dateKey })); setError(null); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to load the Markdown Sheet."); }
  };
  useEffect(() => { void load(); }, [locationId, dateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // The panel intentionally mirrors session-scoped staff selection and server state when opened.
  useEffect(() => { if (!open) return; void load(); }, [open, locationId, dateKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const filteredProducts = useMemo(() => {
    const source = search.trim() ? (data?.catalogue ?? []) : (data?.products ?? []);
    return source.filter(product => product.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).slice(0, 30);
  }, [data?.catalogue, data?.products, search]);
  const itemFor = (productId: string, mode: string) => data?.items.find(item => item.productId === productId && item.mode === mode);
  const change = async (product: Product, mode: "use" | "reduce", delta: 1 | -1) => {
    if (!senderId) { setError("Select your name first."); return; }
    const productId = idOf(product); const key = `${productId}:${mode}`; setPending(current => new Set(current).add(key)); setError(null);
    try { const result = await restApi.compliance.markdownSheet.change({ locationId, dateKey, productId: product.catalogueProductId || product.wastageItemId ? undefined : productId || undefined, catalogueProductId: product.catalogueProductId, wastageItemId: product.wastageItemId, teamMemberId: senderId, mode, action: "quantity", delta, idempotencyKey: makeKey() }); setDelivery(result?.state === "pending" ? "Saved on this device — pending synchronisation" : "Saved"); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save the quantity."); }
    finally { setPending(current => { const next = new Set(current); next.delete(key); return next; }); }
  };
  const complete = async (item: Item) => {
    if (!senderId) { setError("Choose the staff member completing the item."); return; }
    setPending(current => new Set(current).add(item.id)); setError(null);
    try { const result = await restApi.compliance.markdownSheet.change({ locationId, dateKey, productId: item.productId, mode: item.mode, action: "complete", completed: !item.completedAt, teamMemberId: senderId, idempotencyKey: makeKey() }); setDelivery(result?.state === "pending" ? "Saved on this device — pending synchronisation" : "Saved"); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save completion."); }
    finally { setPending(current => { const next = new Set(current); next.delete(item.id); return next; }); }
  };
  const reviewReminder = async (item: Item) => {
    if (!senderId) { setError("Select your name first."); return; }
    try { const result = await restApi.compliance.markdownSheet.change({ locationId, dateKey, action: "review-reminder", reminderItemId: item.id, teamMemberId: senderId, idempotencyKey: makeKey() }); setDelivery(result?.state === "pending" ? "Saved on this device — pending synchronisation" : "Saved"); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save the reminder confirmation."); }
  };
  const addTemporaryProduct = async () => {
    if (!newProduct.trim() || !senderId) return;
    try { const result = await restApi.compliance.markdownSheet.change({ locationId, dateKey, temporaryName: newProduct.trim(), teamMemberId: senderId, mode, action: "quantity", delta: 1, idempotencyKey: makeKey() }); setNewProduct(""); setDelivery(result?.state === "pending" ? "Saved on this device — pending synchronisation" : "Saved"); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to add this product."); }
  };
  const saveFutureProduct = async () => {
    if (!newProduct.trim()) return;
    try { await restApi.admin.markdownSheet.update({ locationId, action: "add-custom", name: newProduct.trim() }); setNewProduct(""); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this product."); }
  };
  const groups = (mode: "use" | "reduce") => data?.items.filter(item => item.mode === mode && item.quantity > 0) ?? [];

  return <>
    <button type="button" aria-label="Open Markdown Sheet" onClick={() => setOpen(value => { if (!value) setTab("view"); setShowOutstanding(Boolean(data?.reminder)); return !value; })} className="relative flex size-10 items-center justify-center rounded-xl text-[#202522] transition hover:bg-brand-yellow/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"><ClipboardList className="size-5" aria-hidden="true" />{data?.reminder && <span className="absolute right-0.5 top-0.5 flex min-w-4 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full bg-[#b64738] px-1 text-[10px] font-bold leading-4 text-white">!</span>}</button>
    {open && <section aria-label="Markdown Sheet" className="fixed inset-x-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100vh-5.5rem-env(safe-area-inset-top))] flex-col overflow-hidden rounded-3xl border border-black/[0.08] bg-white shadow-[0_18px_60px_rgba(23,25,24,0.2)] sm:left-auto sm:right-5 sm:w-[min(34rem,calc(100vw-2rem))]">
      <div className="flex items-start justify-between gap-3 border-b border-black/[0.07] p-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#89918b]">mise. sheet</p><h2 className="mt-1 text-lg font-bold">Markdown Sheet · {locationName}</h2></div><Button type="button" variant="ghost" size="icon" className="size-9 rounded-xl" onClick={() => setOpen(false)} aria-label="Close Markdown Sheet"><X className="size-4" /></Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error && <p role="alert" className="mb-3 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm font-semibold text-[#a43f34]">{error}</p>}
        {data?.reminder && <div className="mb-4 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-3"><p className="text-sm font-semibold">Previous days: {data.reminder.count} item{data.reminder.count === 1 ? "" : "s"} still need checking.</p><p className="mt-1 text-xs text-[#727a74]">Confirm they have been used, sold or removed from sale before continuing.</p><Button type="button" className="mt-3 h-9 rounded-xl bg-[#202522] text-white" onClick={() => { setShowOutstanding(true); setTab("view"); }}>Review outstanding items</Button></div>}
        <ActiveStaffControl teamMembers={teamMembers} value={senderId} onChange={setSenderId} label="Recording as" />
        {delivery && <p role="status" className="my-3 text-sm">{delivery}</p>}
        {showOutstanding && data?.reminder && <section className="my-4 space-y-3" aria-label="Outstanding items from previous days">{data.reminder.items.map(item => <div key={item.id} className="rounded-xl border border-red-200 p-3"><p className="font-semibold">{item.dateKey} · {item.productName} · {item.quantity} · To {item.mode === "use" ? "Use" : "Reduce"}</p><p className="mt-2 text-sm">Check that all affected units have been used, sold or removed from sale.</p><Button disabled={!senderId} className="mt-3 min-h-11" onClick={() => { if (window.confirm("Have all affected units been checked and dealt with?")) void reviewReminder(item); }}>Confirm checked and dealt with</Button></div>)}</section>}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#f3f3f1] p-1" role="tablist" aria-label="Markdown Sheet view"><button type="button" role="tab" aria-selected={tab === "view"} className={`h-10 rounded-xl text-sm font-semibold ${tab === "view" ? "bg-white shadow-sm" : "text-[#727a74]"}`} onClick={() => setTab("view")}>View</button><button type="button" role="tab" aria-selected={tab === "add"} className={`h-10 rounded-xl text-sm font-semibold ${tab === "add" ? "bg-brand-yellow text-[#171717]" : "text-[#727a74]"}`} onClick={() => setTab("add")}>Add</button></div>
        {tab === "add" && <><label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-black/[0.1] px-3"><Search className="size-4 text-[#89918b]" /><span className="sr-only">Search products</span><input value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 text-sm outline-none" placeholder="Find a product" /></label><div className="mb-3 grid grid-cols-2 gap-2"><Button type="button" className={`h-10 rounded-xl ${mode === "use" ? "bg-brand-yellow text-[#171717]" : "bg-[#f3f3f1] text-[#202522]"}`} onClick={() => setMode("use")}>To Use</Button><Button type="button" className={`h-10 rounded-xl ${mode === "reduce" ? "bg-brand-yellow text-[#171717]" : "bg-[#f3f3f1] text-[#202522]"}`} onClick={() => setMode("reduce")}>To Reduce</Button></div><div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">{filteredProducts.map(product => <div key={idOf(product)} className="rounded-2xl border border-black/[0.08] p-2"><p className="min-h-10 text-sm font-semibold leading-5">{product.name}</p><div className="mt-2 grid grid-cols-2 gap-1"><Button type="button" className="h-9 rounded-xl bg-brand-yellow px-2 text-xs text-[#171717]" disabled={pending.has(`${idOf(product)}:${mode}`)} onClick={() => void change(product, mode, 1)}>{mode === "use" ? "Use" : "Reduce"} +</Button><Button type="button" className="h-9 rounded-xl bg-[#f3f3f1] px-2 text-xs text-[#202522]" disabled={pending.has(`${idOf(product)}:${mode}`) || !(itemFor(idOf(product), mode)?.quantity)} onClick={() => void change(product, mode, -1)}>{mode === "use" ? "Use" : "Reduce"} −</Button></div></div>)}</div></>}
        {(["use", "reduce"] as const).map(mode => <section key={mode} className="mb-5"><h3 className="mb-2 text-sm font-bold">To {mode === "use" ? "Use" : "Reduce"}</h3>{groups(mode).length ? <div className="space-y-2">{groups(mode).map(item => <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-black/[0.08] p-3"><button type="button" disabled={!senderId || pending.has(item.id)} aria-label={`${item.completedAt ? "Undo" : "Complete"} ${item.productName}`} onClick={() => void complete(item)} className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 ${item.completedAt ? "border-[#3f8b5b] bg-[#3f8b5b] text-white" : "border-black/[0.2]"}`}>{item.completedAt ? "✓" : ""}</button><div className="min-w-0 flex-1"><p className="font-semibold">{item.productName}</p><p className="text-xs text-[#727a74]">Quantity {item.quantity}{item.completedAt ? " · completed" : " · outstanding"}</p></div>{tab === "add" && <div className="flex items-center gap-1"><Button type="button" variant="ghost" size="icon" className="size-8 rounded-xl" disabled={pending.has(`${item.productId}:${item.mode}`)} onClick={() => void change({ id: item.productId, name: item.productName }, item.mode, -1)} aria-label={`Remove one ${item.productName}`}><Minus className="size-4" /></Button><span className="min-w-5 text-center font-bold">{item.quantity}</span><Button type="button" variant="ghost" size="icon" className="size-8 rounded-xl" disabled={pending.has(`${item.productId}:${item.mode}`)} onClick={() => void change({ id: item.productId, name: item.productName }, item.mode, 1)} aria-label={`Add one ${item.productName}`}><Plus className="size-4" /></Button></div>}</div>)}</div> : <p className="rounded-xl border border-dashed border-black/[0.12] p-3 text-sm text-[#727a74]">Nothing selected.</p>}</section>)}
        {tab === "add" && <div className="border-t border-black/[0.07] pt-4"><p className="text-xs font-semibold text-[#4e5851]">Add a product</p><div className="mt-2 flex flex-col gap-2"><input value={newProduct} onChange={event => setNewProduct(event.target.value)} className="min-w-0 rounded-xl border border-black/[0.1] px-3 text-sm" placeholder="e.g. Chicken filling" /><div className="grid grid-cols-2 gap-2"><Button type="button" className="rounded-xl bg-brand-yellow text-[#171717]" onClick={() => void addTemporaryProduct()}>Just today</Button>{canManageProducts && <Button type="button" className="rounded-xl bg-[#202522] text-white" onClick={() => void saveFutureProduct()}>Save for future</Button>}</div></div></div>}
      </div>
    </section>}
  </>;
}
