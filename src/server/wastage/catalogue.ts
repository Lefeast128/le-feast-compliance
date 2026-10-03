export const MAX_AD_HOC_WASTAGE_NAME_LENGTH = 200;

type WastageInput = {
  noWaste?: unknown;
  itemId?: unknown;
  catalogueProductId?: unknown;
  adHocItemName?: unknown;
  quantity?: unknown;
};

const supplied = (input: WastageInput, key: keyof WastageInput) => input[key] !== undefined && input[key] !== null;

export type WastageMode =
  | { source: "no_waste" }
  | { source: "catalogue"; productId: string }
  | { source: "adhoc"; itemName: string }
  | { source: "legacy"; itemId: string };

export function parseWastageMode(input: WastageInput): WastageMode {
  if (input.noWaste === true) {
    if (supplied(input, "itemId") || supplied(input, "catalogueProductId") || supplied(input, "adHocItemName") || supplied(input, "quantity")) {
      throw new Error("No Waste cannot include an item, product, name or quantity");
    }
    return { source: "no_waste" };
  }

  const choices = [supplied(input, "catalogueProductId"), supplied(input, "adHocItemName"), supplied(input, "itemId")].filter(Boolean).length;
  if (choices !== 1) throw new Error("Provide exactly one wastage product, ad-hoc name or legacy item");

  if (supplied(input, "catalogueProductId")) {
    if (typeof input.catalogueProductId !== "string") throw new Error("catalogueProductId must be a valid identifier");
    return { source: "catalogue", productId: input.catalogueProductId };
  }

  if (supplied(input, "adHocItemName")) {
    if (typeof input.adHocItemName !== "string") throw new Error("Ad-hoc item name is required");
    const itemName = input.adHocItemName.trim();
    if (!itemName) throw new Error("Ad-hoc item name is required");
    if (itemName.length > MAX_AD_HOC_WASTAGE_NAME_LENGTH) throw new Error("Ad-hoc item name is too long");
    return { source: "adhoc", itemName };
  }

  if (typeof input.itemId !== "string") throw new Error("itemId must be a valid identifier");
  return { source: "legacy", itemId: input.itemId };
}

export function isUsableCatalogueProduct(product: { active: boolean; excludedFromWastage: boolean }) {
  return product.active && !product.excludedFromWastage;
}

export function assertCatalogueProductUsable(product: { locationId: string; active: boolean; excludedFromWastage: boolean }, locationId: string) {
  if (product.locationId !== locationId) throw new Error("Catalogue product does not belong to this location");
  if (!product.active) throw new Error("Catalogue product is inactive");
  if (product.excludedFromWastage) throw new Error("Catalogue product is excluded from wastage");
}

export function catalogueWastageSnapshot(product: { id: string; plu: number; name: string; wastageCategory: string | null }) {
  return {
    catalogueProductId: product.id,
    cataloguePlu: product.plu,
    itemName: product.name,
    categorySnapshot: product.wastageCategory,
    source: "catalogue" as const,
  };
}
