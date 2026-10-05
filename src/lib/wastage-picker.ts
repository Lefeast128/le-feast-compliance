export type WastagePickerMode = "catalogue" | "adhoc" | "no_waste";

export type WastagePickerProduct = {
  id: string;
  plu: number;
  name: string;
  category?: string | null;
  department?: string | null;
  group?: string | null;
  active?: boolean;
  excludedFromWastage?: boolean;
};

export const ALL_WASTAGE_CATEGORY = "All";

export type WastagePickerDraft = {
  mode: WastagePickerMode;
  catalogueProductId: string;
  adHocItemName: string;
  quantity: string;
  notes: string;
  teamMemberId: string;
};

export const emptyWastagePickerDraft = (): WastagePickerDraft => ({ mode: "catalogue", catalogueProductId: "", adHocItemName: "", quantity: "", notes: "", teamMemberId: "" });

const nonBlank = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

export function wastagePickerCategory(product: Pick<WastagePickerProduct, "group" | "department">) {
  return nonBlank(product.group) ?? nonBlank(product.department) ?? "Other";
}

export function eligibleWastageProducts(products: WastagePickerProduct[]) {
  return products.filter(product => product.active !== false && product.excludedFromWastage !== true);
}

export function sortWastageProducts(products: WastagePickerProduct[]) {
  return [...products].sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) || left.plu - right.plu);
}

export function getWastagePickerCategories(products: WastagePickerProduct[]) {
  const categories = new Set(eligibleWastageProducts(products).map(wastagePickerCategory));
  categories.delete(ALL_WASTAGE_CATEGORY);
  return [ALL_WASTAGE_CATEGORY, ...Array.from(categories).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }))];
}

export function filterWastageProducts(products: WastagePickerProduct[], search: string, selectedCategory = ALL_WASTAGE_CATEGORY) {
  const categoryProducts = eligibleWastageProducts(products).filter(product => selectedCategory === ALL_WASTAGE_CATEGORY || wastagePickerCategory(product) === selectedCategory);
  const term = search.trim().toLocaleLowerCase();
  const filtered = !term ? categoryProducts : categoryProducts.filter(product => product.name.toLocaleLowerCase().includes(term) || String(product.plu).includes(term));
  return sortWastageProducts(filtered);
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
