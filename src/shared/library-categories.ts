export const LIBRARY_CATEGORY_OPTIONS = [
  { value: "eho_food_safety_certificates", label: "EHO & Food Safety Certificates", description: "Food-safety certificates, EHO guidance and essential records." },
  { value: "le_feast_company_documents", label: "Le Feast Company Documents", description: "Merrychef, panic alarm, allergen and internal operating guidance." },
  { value: "licensing", label: "Licensing", description: "Licensing awareness certificates and licensing guidance." },
  { value: "other", label: "Other", description: "Other essential store reference documents." },
] as const;

const LEGACY_LIBRARY_CATEGORIES: Record<string, { label: string; description: string }> = {
  food_safety: { label: "Food Safety & EHO", description: "Food safety diaries, EHO guidance and essential records." },
  food_safety_eho: { label: "Food Safety & EHO", description: "Food safety diaries, EHO guidance and essential records." },
  store_station: { label: "Store & Station", description: "Store and station operating guidance." },
  health_safety: { label: "Health & Safety", description: "Health, safety and fire reference material." },
  policies_procedures: { label: "Policies & Procedures", description: "Policies and procedures for store teams." },
};

export function libraryCategoryLabel(value: string | null | undefined) {
  return LIBRARY_CATEGORY_OPTIONS.find(category => category.value === value)?.label ?? LEGACY_LIBRARY_CATEGORIES[value ?? ""]?.label ?? (value ? value.replace(/[_-]+/g, " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Other / Uncategorized");
}

export function libraryCategoryDescription(value: string | null | undefined) {
  return LIBRARY_CATEGORY_OPTIONS.find(category => category.value === value)?.description ?? LEGACY_LIBRARY_CATEGORIES[value ?? ""]?.description ?? "Other essential store reference material.";
}

export function libraryCategorySort(value: string) {
  const index = LIBRARY_CATEGORY_OPTIONS.findIndex(category => category.value === value);
  return index === -1 ? LIBRARY_CATEGORY_OPTIONS.length + value.localeCompare("other") : index;
}
