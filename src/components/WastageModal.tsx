import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_WASTAGE_CATEGORY, buildWastagePayload, emptyWastagePickerDraft, filterWastageProducts, getWastagePickerCategories, isPositiveQuantity, setWastagePickerMode, wastagePickerCategory, type WastagePickerDraft, type WastagePickerMode, type WastagePickerProduct } from "@/lib/wastage-picker";

type TeamMember = { _id?: string; id?: string; name: string };
type Props = {
  products: WastagePickerProduct[];
  teamMembers: TeamMember[];
  loading: boolean;
  error: string | null;
  onSave: (payload: ReturnType<typeof buildWastagePayload>) => Promise<void>;
  onClose: () => void;
};

const memberId = (member: TeamMember) => member._id ?? member.id ?? "";

export default function WastageModal({ products, teamMembers, loading, error, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<WastagePickerDraft>(() => emptyWastagePickerDraft());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_WASTAGE_CATEGORY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const categories = useMemo(() => getWastagePickerCategories(products), [products]);
  const selectedCategory = categories.includes(category) ? category : ALL_WASTAGE_CATEGORY;
  const filteredProducts = useMemo(() => filterWastageProducts(products, search, selectedCategory), [products, search, selectedCategory]);
  const setMode = (mode: WastagePickerMode) => {
    setDraft(current => setWastagePickerMode(current, mode));
    setSearch("");
    setSaveError(null);
  };
  const update = <K extends keyof WastagePickerDraft>(key: K, value: WastagePickerDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const submit = async () => {
    setSaveError(null);
    try {
      setSaving(true);
      await onSave(buildWastagePayload(draft));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to record wastage");
    } finally {
      setSaving(false);
    }
  };
  const selectedProduct = products.find(product => product.id === draft.catalogueProductId);
  const canSave = Boolean(draft.teamMemberId) && (draft.mode === "no_waste" || (isPositiveQuantity(draft.quantity) && (draft.mode === "catalogue" ? Boolean(draft.catalogueProductId) : Boolean(draft.adHocItemName.trim()))));

  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Daily checks</p><h2 className="mt-2 text-2xl font-semibold">Record wastage</h2></div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close wastage form"><X /></Button>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-2" role="tablist" aria-label="Wastage type">
        <ModeButton active={draft.mode === "catalogue"} onClick={() => setMode("catalogue")}>Catalogue</ModeButton>
        <ModeButton active={draft.mode === "adhoc"} onClick={() => setMode("adhoc")}>Add manually</ModeButton>
        <ModeButton active={draft.mode === "no_waste"} onClick={() => setMode("no_waste")}>No Waste</ModeButton>
      </div>
      {draft.mode === "catalogue" && <div className="mt-5">
        <label className="block text-sm font-semibold">Search product or PLU<div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#89918b]" /><Input autoFocus value={search} onChange={event => setSearch(event.target.value)} className="h-12 pl-9" placeholder="Search product or PLU" /></div></label>
        {loading && <p className="mt-4 rounded-xl bg-[#fafbf9] p-4 text-sm text-[#727a74]">Loading TouchOffice products…</p>}
        {!loading && error && <div className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4 text-sm text-[#8f3a31]"><p>Catalogue products could not be loaded.</p><p className="mt-1">You can add an item manually instead.</p><Button type="button" variant="outline" className="mt-3 h-11" onClick={() => setMode("adhoc")}>Add an item manually</Button></div>}
        {!loading && !error && <div className="mt-4" role="tablist" aria-label="Wastage category"><p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">Category</p><div className="-mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1">{categories.map(item => <button type="button" role="tab" aria-selected={selectedCategory === item} key={item} onClick={() => setCategory(item)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${selectedCategory === item ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.1] bg-white text-[#171918]"}`}>{item}</button>)}</div></div>}
        {!loading && !error && !filteredProducts.length && <div className="mt-4 rounded-xl bg-[#fafbf9] p-4 text-sm text-[#727a74]">No matching TouchOffice products. If the item is legitimate but missing, choose Add manually.</div>}
        {!loading && !error && filteredProducts.length > 0 && <div className="mt-3 max-h-56 space-y-2 overflow-y-auto" role="listbox" aria-label="TouchOffice products">{filteredProducts.map(product => <button type="button" role="option" aria-selected={draft.catalogueProductId === product.id} key={product.id} onClick={() => update("catalogueProductId", product.id)} className={`w-full rounded-xl border p-3 text-left ${draft.catalogueProductId === product.id ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.08] bg-white"}`}><span className="block font-semibold">{product.name}</span><span className={`mt-1 block text-xs ${draft.catalogueProductId === product.id ? "text-white/75" : "text-[#727a74]"}`}>PLU {product.plu} · {wastagePickerCategory(product)}</span></button>)}</div>}
        {selectedProduct && <p className="mt-3 text-sm text-[#727a74]">Selected: <span className="font-semibold text-[#171918]">{selectedProduct.name}</span></p>}
      </div>}
      {draft.mode === "adhoc" && <div className="mt-5"><label className="block text-sm font-semibold">Item name<Input autoFocus value={draft.adHocItemName} onChange={event => update("adHocItemName", event.target.value)} className="mt-2 h-12" placeholder="Enter item name" maxLength={200} /></label><p className="mt-2 text-xs text-[#89918b]">Use this only when the item is not available in the TouchOffice catalogue.</p></div>}
      {draft.mode !== "no_waste" && <label className="mt-4 block text-sm font-semibold">Quantity<Input type="number" min="0.01" step="any" inputMode="decimal" value={draft.quantity} onChange={event => update("quantity", event.target.value)} className="mt-2 h-12" placeholder="e.g. 3" /></label>}
      <label className="mt-4 block text-sm font-semibold">Notes (optional)<textarea value={draft.notes} onChange={event => update("notes", event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3" placeholder="Reason or context" /></label>
      <label className="mt-5 block text-sm font-semibold">Recorded by<select value={draft.teamMemberId} onChange={event => update("teamMemberId", event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="">Select team member</option>{teamMembers.map(member => <option key={memberId(member)} value={memberId(member)}>{member.name}</option>)}</select></label>
      {saveError && <p className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#8f3a31]">{saveError}</p>}
      <Button disabled={!canSave || saving} className="mt-7 h-14 w-full bg-[#f4c542] font-semibold text-[#171717]" onClick={submit}>{saving ? "Saving…" : draft.mode === "no_waste" ? "Save no waste" : "Save wastage record"}</Button>
    </div>
  </div>;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`min-h-11 rounded-xl border px-2 text-xs font-semibold sm:text-sm ${active ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.1] bg-white text-[#171918]"}`}>{children}</button>;
}
