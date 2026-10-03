export type CatalogueReviewFilter = "all" | "pending" | "reviewed";
export type CatalogueAvailabilityFilter = "all" | "included" | "excluded";

export type CatalogueAdminProduct = {
  id: string;
  _id?: string;
  plu: number;
  name: string;
  department?: string | null;
  group?: string | null;
  wastageCategory?: string | null;
  category?: string | null;
  needsCategoryReview: boolean;
  excludedFromWastage: boolean;
  active?: boolean;
};

export type CatalogueEditorState = {
  locationId: string;
  productId: string;
  category: string;
  included: boolean;
  completeReview: boolean;
};

const productCategory = (product: CatalogueAdminProduct) => product.wastageCategory ?? product.category ?? null;

export function filterCatalogueProducts(products: CatalogueAdminProduct[], search: string, review: CatalogueReviewFilter, availability: CatalogueAvailabilityFilter) {
  const term = search.trim().toLocaleLowerCase();
  return products.filter(product => {
    const matchesSearch = !term || [product.name, product.plu, product.department, product.group, productCategory(product)].some(value => String(value ?? "").toLocaleLowerCase().includes(term));
    const matchesReview = review === "all" || (review === "pending" ? product.needsCategoryReview : !product.needsCategoryReview);
    const matchesAvailability = availability === "all" || (availability === "included" ? !product.excludedFromWastage : product.excludedFromWastage);
    return matchesSearch && matchesReview && matchesAvailability;
  });
}

export function getCategorySuggestions(products: CatalogueAdminProduct[]) {
  return [...new Set(products.map(productCategory).filter((category): category is string => Boolean(category?.trim())).map(category => category.trim()))].sort((a, b) => a.localeCompare(b));
}

export function createCatalogueEditor(product: CatalogueAdminProduct, locationId: string): CatalogueEditorState {
  return { locationId, productId: product.id ?? product._id ?? "", category: productCategory(product) ?? "", included: !product.excludedFromWastage, completeReview: !product.needsCategoryReview };
}

export function resetCatalogueEditor(): null {
  return null;
}

export function clearEditorForStoreChange(editor: CatalogueEditorState | null, locationId: string) {
  return editor?.locationId === locationId ? editor : null;
}

export function buildCatalogueUpdatePayload(editor: CatalogueEditorState) {
  return {
    locationId: editor.locationId,
    category: editor.category.trim() || null,
    excluded: !editor.included,
    completeReview: editor.completeReview,
  };
}
