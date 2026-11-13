import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildWastagePayload, emptyWastagePickerDraft, filterWastageProducts, getWastagePickerCategories, isPositiveQuantity, setWastagePickerMode, type WastagePickerDraft, type WastagePickerMode, type WastagePickerProduct } from "@/lib/wastage-picker";
import { ActiveStaffControl } from "@/components/dashboard/StaffAttribution";
import { useActiveTeamMember } from "@/hooks/use-active-team-member";
import { WorkflowSteps } from "@/components/WorkflowSteps";

type Props = {
  locationId: string; products: WastagePickerProduct[]; configuredCategories?: string[];
  teamMembers: { _id?: string; id?: string; name: string }[];
  loading: boolean; error: string | null;
  onSave: (payload: ReturnType<typeof buildWastagePayload>) => Promise<void>; onClose: () => void;
};

export default function WastageModal({ locationId, products, configuredCategories = [], teamMembers, loading, error, onSave, onClose }: Props) {
  const members = useMemo(() => teamMembers.map(member => ({ _id: member._id ?? member.id ?? "", name: member.name })), [teamMembers]);
  const [memberId, setMemberId] = useActiveTeamMember(locationId, members);
  const [draft, setDraft] = useState<WastagePickerDraft>(emptyWastagePickerDraft);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const categories = useMemo(() => [...new Set([...configuredCategories, ...getWastagePickerCategories(products)])], [configuredCategories, products]);
  const selectedCategory = categories.includes(category) ? category : "";
  const filteredProducts = useMemo(() => selectedCategory ? filterWastageProducts(products, search, selectedCategory) : [], [products, search, selectedCategory]);
  const selectedProduct = products.find(product => product.id === draft.catalogueProductId && (product.source ?? "catalogue") === draft.catalogueProductSource);
  const validMember = members.some(member => member._id === memberId);
  const validProduct = draft.mode === "no_waste" || (draft.mode === "adhoc" ? Boolean(draft.adHocItemName.trim()) : Boolean(selectedProduct));
  const validDetails = draft.mode === "no_waste" || isPositiveQuantity(draft.quantity);
  const setMode = (mode: WastagePickerMode) => { setDraft(current => setWastagePickerMode(current, mode)); setSearch(""); };
  const update = <K extends keyof WastagePickerDraft>(key: K, value: WastagePickerDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const canNext = validMember && (step === 0 || (step === 1 ? draft.mode !== "catalogue" || Boolean(selectedCategory) : step === 2 ? validProduct : validProduct && validDetails));
  const submit = async () => {
    if (!validMember || !validProduct || !validDetails || saving) return;
    setSaveError(null); setSaving(true);
    try { await onSave(buildWastagePayload({ ...draft, teamMemberId: memberId })); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Unable to record wastage"); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
    <section role="dialog" aria-modal="true" aria-label="Record wastage" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
      <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">Record wastage</h2><Button variant="ghost" size="icon" onClick={onClose} disabled={saving} aria-label="Close wastage form"><X /></Button></div>
      {step === 0 && <ActiveStaffControl teamMembers={members} value={memberId} onChange={setMemberId} label="Recording wastage as" />}
      {step > 0 && <p className="mb-4 text-sm">Recording as <strong>{members.find(member => member._id === memberId)?.name ?? "Select your name"}</strong></p>}
      {step === 1 && <>
        <div className="mb-4 grid grid-cols-3 gap-2">{(["catalogue", "adhoc", "no_waste"] as const).map(mode => <Button key={mode} variant="outline" aria-pressed={draft.mode === mode} className={`min-h-11 px-2 ${draft.mode === mode ? "bg-brand-yellow text-black" : ""}`} onClick={() => setMode(mode)}>{mode === "catalogue" ? "Products" : mode === "adhoc" ? "Add manually" : "No Waste"}</Button>)}</div>
        {draft.mode === "catalogue" && <><h3 className="mb-3 font-semibold">Choose a category</h3>{loading && <p>Loading products…</p>}{error && <p role="alert">{error} You can still add a one-off item manually.</p>}<div className="grid grid-cols-2 gap-2">{categories.map(item => <Button key={item} variant="outline" aria-pressed={selectedCategory === item} className={`min-h-11 h-auto whitespace-normal ${selectedCategory === item ? "bg-brand-yellow text-black" : ""}`} onClick={() => { setCategory(item); update("catalogueProductId", ""); }}>{item}</Button>)}</div></>}
        {draft.mode === "no_waste" && <p>You are recording that there was no waste today.</p>}
        {draft.mode === "adhoc" && <p>Add a one-off item without changing the store catalogue.</p>}
      </>}
      {step === 2 && <>{draft.mode === "catalogue" ? <><label className="font-semibold">Search {selectedCategory}<Input className="my-3 min-h-11" value={search} onChange={event => setSearch(event.target.value)} placeholder="Product name or PLU" /></label><div className="max-h-[42dvh] space-y-2 overflow-y-auto">{filteredProducts.map(product => <button key={`${product.source}:${product.id}`} type="button" aria-pressed={selectedProduct?.id === product.id} onClick={() => setDraft(current => ({ ...current, catalogueProductId: product.id, catalogueProductSource: product.source ?? "catalogue" }))} className={`min-h-11 w-full rounded-xl border p-3 text-left ${selectedProduct?.id === product.id ? "bg-brand-yellow" : "bg-white"}`}>{product.name}</button>)}{!filteredProducts.length && <p>No matching products. Go back to choose another category or add manually.</p>}</div></> : draft.mode === "adhoc" ? <label className="font-semibold">Item name<Input className="mt-3 min-h-11" maxLength={200} value={draft.adHocItemName} onChange={event => update("adHocItemName", event.target.value)} /></label> : <p>No products to select for a No Waste record.</p>}</>}
      {step === 3 && <>{draft.mode !== "no_waste" && <label className="block font-semibold">Quantity<Input className="my-3 min-h-11" type="number" min="0.01" step="any" inputMode="decimal" value={draft.quantity} onChange={event => update("quantity", event.target.value)} /></label>}<label className="block font-semibold">Notes (optional)<textarea className="mt-3 min-h-20 w-full rounded-xl border p-3" value={draft.notes} onChange={event => update("notes", event.target.value)} /></label></>}
      {step === 4 && <div className="rounded-xl border p-4"><h3 className="font-semibold">Check before saving</h3><p className="mt-2">{draft.mode === "no_waste" ? "No waste today" : `${draft.quantity} × ${draft.mode === "adhoc" ? draft.adHocItemName : selectedProduct?.name ?? "Product unavailable — go back"}`}</p>{draft.notes && <p className="mt-2 whitespace-pre-wrap">{draft.notes}</p>}</div>}
      {saveError && <p role="alert" className="mt-4 text-red-700">{saveError}</p>}
      <WorkflowSteps steps={["Staff", "Category", "Product", "Details", "Confirmation"]} step={step} onBack={() => setStep(value => value - 1)} onNext={() => step === 4 ? void submit() : setStep(value => value + 1)} canNext={canNext} busy={saving} confirm="Confirm and save" />
    </section>
  </div>;
}
