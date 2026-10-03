export type WastagePickerMode = "catalogue" | "adhoc" | "no_waste";

export type WastagePickerProduct = {
  id: string;
  plu: number;
  name: string;
  category?: string | null;
  department?: string | null;
};

export type WastagePickerDraft = {
  mode: WastagePickerMode;
  catalogueProductId: string;
  adHocItemName: string;
  quantity: string;
  notes: string;
  teamMemberId: string;
};

export const emptyWastagePickerDraft = (): WastagePickerDraft => ({ mode: "catalogue", catalogueProductId: "", adHocItemName: "", quantity: "", notes: "", teamMemberId: "" });

export function filterWastageProducts(products: WastagePickerProduct[], search: string) {
  const term = search.trim().toLocaleLowerCase();
  if (!term) return products;
  return products.filter(product => product.name.toLocaleLowerCase().includes(term) || String(product.plu).includes(term));
}

export function isPositiveQuantity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0;
}

export function setWastagePickerMode(draft: WastagePickerDraft, mode: WastagePickerMode): WastagePickerDraft {
  if (mode === "no_waste") return { ...draft, mode, catalogueProductId: "", adHocItemName: "", quantity: "" };
  if (mode === "catalogue") return { ...draft, mode, adHocItemName: "" };
  return { ...draft, mode, catalogueProductId: "" };
}

export function buildWastagePayload(draft: WastagePickerDraft) {
  if (!draft.teamMemberId) throw new Error("Select the team member who recorded this wastage");
  if (draft.mode === "no_waste") return { noWaste: true, teamMemberId: draft.teamMemberId, ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) };
  if (!isPositiveQuantity(draft.quantity)) throw new Error("Enter a positive quantity");
  if (draft.mode === "catalogue") {
    if (!draft.catalogueProductId) throw new Error("Select a catalogue product");
    return { noWaste: false, catalogueProductId: draft.catalogueProductId, quantity: draft.quantity.trim(), teamMemberId: draft.teamMemberId, ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) };
  }
  const adHocItemName = draft.adHocItemName.trim();
  if (!adHocItemName) throw new Error("Enter an item name");
  return { noWaste: false, adHocItemName, quantity: draft.quantity.trim(), teamMemberId: draft.teamMemberId, ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}) };
}
