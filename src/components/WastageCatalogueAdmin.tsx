/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Pencil, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { restApi, useRestMutation } from "@/lib/rest-domain";
import { buildCatalogueUpdatePayload, clearEditorForStoreChange, createCatalogueEditor, filterCatalogueProducts, getCategorySuggestions, resetCatalogueEditor, type CatalogueAdminProduct, type CatalogueAvailabilityFilter, type CatalogueEditorState, type CatalogueReviewFilter } from "@/lib/catalogue-admin";

type LocationOption = { id?: string; _id?: string; name: string };
type Props = { locationId: string; locations: LocationOption[]; onClose: () => void; onOpenReports?: () => void };
type SyncStatus = { lastSuccessfulSyncAt?: string | null; lastError?: string | null };
type CatalogueResponse = { products?: CatalogueAdminProduct[]; syncStatus?: SyncStatus | null };
type CatalogueData = { locationId: string; products: CatalogueAdminProduct[]; syncStatus: SyncStatus | null };

const locationIdOf = (location: LocationOption) => location._id ?? location.id ?? "";
const safeError = (error: unknown, fallback: string) => error instanceof Error && error.message ? error.message : fallback;
const categoryOf = (product: CatalogueAdminProduct) => product.wastageCategory ?? product.category ?? "";
const formatSyncTime = (value: unknown) => value ? new Date(String(value)).toLocaleString("en-GB") : "Not yet synced";

export default function WastageCatalogueAdmin({ locationId, locations, onClose, onOpenReports }: Props) {
  const [activeLocationId, setActiveLocationId] = useState(locationId);
  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [reviewFilter, setReviewFilter] = useState<CatalogueReviewFilter>("pending");
  const [availabilityFilter, setAvailabilityFilter] = useState<CatalogueAvailabilityFilter>("all");
  const [editor, setEditor] = useState<CatalogueEditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const updateWastage = useRestMutation(restApi.catalogue.updateWastage);
  const refreshCatalogue = useRestMutation(restApi.catalogue.refresh);

  useEffect(() => {
    if (!activeLocationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setCatalogue(null);
    restApi.catalogue.list({ locationId: activeLocationId })
      .then((value: CatalogueResponse) => {
        if (cancelled) return;
        setCatalogue({ locationId: activeLocationId, products: value?.products ?? [], syncStatus: value?.syncStatus ?? null });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setCatalogue(null);
        setError(safeError(reason, "Unable to load the TouchOffice catalogue"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeLocationId, revision]);

  const products = useMemo(() => catalogue?.locationId === activeLocationId ? catalogue.products : [], [catalogue, activeLocationId]);
  const categorySuggestions = useMemo(() => getCategorySuggestions(products), [products]);
  const filteredProducts = useMemo(() => filterCatalogueProducts(products, search, reviewFilter, availabilityFilter), [products, search, reviewFilter, availabilityFilter]);
  const pendingCount = products.filter(product => product.needsCategoryReview).length;
  const includedCount = products.filter(product => !product.excludedFromWastage).length;
  const excludedCount = products.filter(product => product.excludedFromWastage).length;
  const activeLocation = locations.find(location => locationIdOf(location) === activeLocationId);

  function changeStore(nextLocationId: string) {
    if (!nextLocationId || nextLocationId === activeLocationId) return;
    setActiveLocationId(nextLocationId);
    setLoading(true);
    setCatalogue(null);
    setEditor(clearEditorForStoreChange(editor, nextLocationId));
    setSearch("");
    setReviewFilter("pending");
    setAvailabilityFilter("all");
    setError(null);
  }

  async function runRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshCatalogue({ locationId: activeLocationId });
      toast.success("TouchOffice catalogue refreshed");
      setRevision(value => value + 1);
    } catch (reason) {
      const message = safeError(reason, "Unable to refresh the TouchOffice catalogue");
      setRefreshError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  }

  function openEditor(product: CatalogueAdminProduct) {
    setSaveError(null);
    setEditor(createCatalogueEditor(product, activeLocationId));
  }

  async function saveEditor() {
    if (!editor) return;
    setSaving(true);
    setSaveError(null);
    try {
      await updateWastage({ productId: editor.productId, ...buildCatalogueUpdatePayload(editor) });
      setEditor(resetCatalogueEditor());
      setRevision(value => value + 1);
      toast.success("Catalogue product updated");
    } catch (reason) {
      setSaveError(safeError(reason, "Unable to update catalogue product"));
    } finally {
      setSaving(false);
    }
  }

  return <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
    <header className="border-b border-black/[0.07] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><Button variant="outline" size="icon" onClick={onClose} aria-label="Back to admin setup"><ArrowLeft className="size-4" /></Button><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Admin setup</p><h1 className="mt-1 text-2xl font-semibold">Wastage catalogue</h1></div></div>
        <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><span className="sr-only">Selected store</span><select value={activeLocationId} onChange={event => changeStore(event.target.value)} className="h-11 rounded-xl border border-black/[0.1] bg-white px-3"><option value="" disabled>Select store</option>{locations.map(location => <option key={locationIdOf(location)} value={locationIdOf(location)}>{location.name}</option>)}</select></label>{onOpenReports && <Button variant="outline" onClick={onOpenReports}>Compliance reports</Button>}<Button variant="outline" onClick={onClose}>Back to setup</Button></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">{activeLocation?.name ?? "Selected store"}</p><p className="mt-2 max-w-2xl text-[#727a74]">Products are synced from TouchOffice. Choose which products staff can record as wastage.</p></div><Button onClick={runRefresh} disabled={refreshing || loading} className="h-12 bg-[#ffde56] font-semibold text-[#171717] hover:bg-[#ffde56]"><RefreshCw className={`mr-2 size-4 ${refreshing ? "animate-spin" : ""}`} />{refreshing ? "Refreshing…" : "Refresh TouchOffice catalogue"}</Button></div>
      {refreshError && <p className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#8f3a31]">{refreshError}</p>}
      <div className="mt-7 grid gap-3 sm:grid-cols-4"><SummaryCard label="Active products" value={products.length} /><SummaryCard label="Awaiting review" value={pendingCount} tone={pendingCount ? "pending" : "normal"} /><SummaryCard label="Included for wastage" value={includedCount} /><SummaryCard label="Excluded from wastage" value={excludedCount} /></div>
      <div className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex flex-col gap-2 text-sm text-[#727a74] sm:flex-row sm:justify-between"><span>Last successful TouchOffice sync: <strong className="text-[#202522]">{formatSyncTime(catalogue?.syncStatus?.lastSuccessfulSyncAt)}</strong></span>{catalogue?.syncStatus?.lastError && <span className="text-[#8f3a31]">Latest sync error: {catalogue.syncStatus.lastError}</span>}</div></div>
      <section className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><label className="block flex-1 text-sm font-semibold">Search product or PLU<div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#89918b]" /><Input value={search} onChange={event => setSearch(event.target.value)} className="h-12 pl-9" placeholder="Search product or PLU" /></div></label><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="text-sm font-semibold">Review<select value={reviewFilter} onChange={event => setReviewFilter(event.target.value as CatalogueReviewFilter)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="pending">Awaiting review</option><option value="all">All</option><option value="reviewed">Reviewed</option></select></label><label className="text-sm font-semibold">Availability<select value={availabilityFilter} onChange={event => setAvailabilityFilter(event.target.value as CatalogueAvailabilityFilter)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="all">All</option><option value="included">Included</option><option value="excluded">Excluded</option></select></label></div></div></section>
      {loading && <div className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">Loading TouchOffice catalogue…</div>}
      {!loading && error && <div className="mt-6 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-6 text-sm text-[#8f3a31]">{error}</div>}
      {!loading && !error && !products.length && <div className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">No active catalogue products are available for this store.</div>}
      {!loading && !error && products.length > 0 && !filteredProducts.length && <div className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-6 text-sm text-[#727a74]">{reviewFilter === "pending" && !pendingCount ? "No products are awaiting review." : "No products match this search or filter."}</div>}
      {!loading && !error && filteredProducts.length > 0 && <div className="mt-6 space-y-3">{filteredProducts.map(product => <ProductRow key={product.id} product={product} onEdit={() => openEditor(product)} />)}</div>}
    </main>
    {editor && <CatalogueEditor editor={editor} product={products.find(product => product.id === editor.productId)} categorySuggestions={categorySuggestions} saving={saving} error={saveError} onChange={setEditor} onSave={saveEditor} onClose={() => setEditor(resetCatalogueEditor())} />}
  </div>;
}

function SummaryCard({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "pending" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "pending" ? "border-[#f0d98a] bg-[#fffdf4]" : "border-black/[0.07] bg-white"}`}><p className="text-xs font-bold uppercase tracking-[0.13em] text-[#89918b]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function ProductRow({ product, onEdit }: { product: CatalogueAdminProduct; onEdit: () => void }) {
  return <article className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{product.name}</h2><StatusPill included={!product.excludedFromWastage}>{product.excludedFromWastage ? "Excluded" : "Included"}</StatusPill><StatusPill included={!product.needsCategoryReview}>{product.needsCategoryReview ? "Needs review" : "Reviewed"}</StatusPill></div><p className="mt-1 text-sm text-[#727a74]">PLU {product.plu}{product.department ? ` · ${product.department}` : ""}{product.group ? ` · ${product.group}` : ""}</p><p className="mt-2 text-sm text-[#727a74]">Wastage category: <span className="font-semibold text-[#202522]">{categoryOf(product) || "Uncategorised"}</span></p></div><Button variant="outline" className="h-11 shrink-0" onClick={onEdit}><Pencil className="mr-2 size-4" /> Review product</Button></div></article>;
}

function StatusPill({ included, children }: { included: boolean; children: string }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${included ? "bg-[#e2f5e8] text-[#287c4d]" : "bg-[#f1f2ef] text-[#727a74]"}`}>{children}</span>;
}

function CatalogueEditor({ editor, product, categorySuggestions, saving, error, onChange, onSave, onClose }: { editor: CatalogueEditorState; product?: CatalogueAdminProduct; categorySuggestions: string[]; saving: boolean; error: string | null; onChange: (value: CatalogueEditorState) => void; onSave: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">TouchOffice product</p><h2 className="mt-2 text-2xl font-semibold">Review catalogue product</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close product editor"><X /></Button></div>{product ? <><div className="mt-6 rounded-2xl bg-[#fafbf9] p-4"><p className="text-lg font-semibold">{product.name}</p><p className="mt-1 text-sm text-[#727a74]">PLU {product.plu}</p><p className="mt-2 text-sm text-[#727a74]">{product.department || "No department"}{product.group ? ` · ${product.group}` : ""}</p></div><label className="mt-5 block text-sm font-semibold">Wastage category<Input list="wastage-category-suggestions" value={editor.category} onChange={event => onChange({ ...editor, category: event.target.value })} className="mt-2 h-12" placeholder="Optional category" maxLength={100} /></label><datalist id="wastage-category-suggestions">{categorySuggestions.map(category => <option key={category} value={category} />)}</datalist><div className="mt-5 grid gap-3 sm:grid-cols-2"><button type="button" aria-pressed={editor.included} onClick={() => onChange({ ...editor, included: true })} className={`min-h-12 rounded-xl border p-3 text-left text-sm font-semibold ${editor.included ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.1] bg-white"}`}><Check className="mr-2 inline size-4" />Included in staff wastage</button><button type="button" aria-pressed={!editor.included} onClick={() => onChange({ ...editor, included: false })} className={`min-h-12 rounded-xl border p-3 text-left text-sm font-semibold ${!editor.included ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.1] bg-white"}`}>Excluded from staff wastage</button></div><label className="mt-5 flex items-center gap-3 rounded-xl border border-black/[0.08] p-4 text-sm font-semibold"><input type="checkbox" checked={editor.completeReview} onChange={event => onChange({ ...editor, completeReview: event.target.checked })} className="size-4" />Review complete</label>{error && <p className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#8f3a31]">{error}</p>}<Button disabled={saving} onClick={onSave} className="mt-6 h-13 w-full bg-[#ffde56] font-semibold text-[#171717] hover:bg-[#ffde56]">{saving ? "Saving…" : "Save catalogue settings"}</Button></> : <p className="mt-6 text-sm text-[#8f3a31]">This product is no longer available in the selected store.</p>}</div></div>;
}
