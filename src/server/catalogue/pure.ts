export const TOUCHOFFICE_SITE_LOCATION_KEYS = { "1": "blackpool", "2": "poulton", "3": "rochdale", "4": "bolton" } as const;
export type CatalogueProduct = { siteId: string; plu: number; name: string; department?: string; group?: string; valueSources: { name: "store" | "head_office" | "missing"; department: "store" | "head_office" | "missing"; group: "store" | "head_office" | "missing" } };
export type ComplianceLocation = { id: string; name: string; shortName: string };
const ratio = 0.5;
export const MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE = 200;
const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object";
const optionalText = (v: unknown, field: string, index: number) => { if (v === null || v === undefined || v === "") return undefined; if (typeof v !== "string") throw new Error(`Catalogue product ${index} has an invalid ${field}`); return v; };
const source = (v: unknown, field: string, index: number) => { if (v !== "store" && v !== "head_office" && v !== "missing") throw new Error(`Catalogue product ${index} has an invalid ${field} source`); return v as "store" | "head_office" | "missing"; };
export function normalizeCataloguePayload(payload: unknown) {
  if (!record(payload) || payload.ok !== true || !Array.isArray(payload.products)) throw new Error("TouchOffice catalogue response is incomplete");
  if (typeof payload.retrievedAt !== "string" || !payload.retrievedAt.trim()) throw new Error("TouchOffice catalogue response has no retrieval time");
  const seen = new Set<string>();
  const products = payload.products.map((raw, index): CatalogueProduct => {
    if (!record(raw)) throw new Error(`Catalogue product ${index} is invalid`);
    const siteId = String(raw.storeId ?? "");
    if (!(siteId in TOUCHOFFICE_SITE_LOCATION_KEYS)) throw new Error(`Catalogue product ${index} has an unknown store`);
    const plu = Number(raw.plu);
    if (!Number.isInteger(plu) || plu < 1) throw new Error(`Catalogue product ${index} has an invalid PLU`);
    if (typeof raw.name !== "string" || !raw.name.trim()) throw new Error(`Catalogue product ${index} has no name`);
    const key = `${siteId}:${plu}`; if (seen.has(key)) throw new Error(`Duplicate TouchOffice product ${key}`); seen.add(key);
    const sources = record(raw.valueSources) ? raw.valueSources : {};
    return { siteId, plu, name: raw.name, department: optionalText(raw.department, "department", index), group: optionalText(raw.group, "group", index), valueSources: { name: source(sources.name, "name", index), department: source(sources.department, "department", index), group: source(sources.group, "group", index) } };
  });
  for (const siteId of Object.keys(TOUCHOFFICE_SITE_LOCATION_KEYS)) if (!products.some(product => product.siteId === siteId)) throw new Error(`TouchOffice catalogue is missing store ${siteId}`);
  return { retrievedAt: payload.retrievedAt, products };
}
const normalise = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function mapCatalogueToLocations(products: CatalogueProduct[], locations: ComplianceLocation[]) {
  const bySite = new Map<string, ComplianceLocation>();
  for (const [siteId, key] of Object.entries(TOUCHOFFICE_SITE_LOCATION_KEYS)) {
    const matches = locations.filter(location => { const name = normalise(location.name); const shortName = normalise(location.shortName); return name === key || shortName === key || name.includes(key); });
    if (matches.length !== 1) throw new Error(`TouchOffice store ${siteId} could not be mapped to one compliance location`);
    bySite.set(siteId, matches[0]);
  }
  return products.map(product => ({ ...product, locationId: bySite.get(product.siteId)!.id }));
}
export function assertCatalogueSize(existing: Array<{ active: boolean }>, incoming: unknown[]) {
  const active = existing.filter(item => item.active).length;
  const minimum = active > 0 ? Math.ceil(active * ratio) : MIN_INITIAL_CATALOGUE_PRODUCTS_PER_STORE;
  if (incoming.length < minimum) throw new Error("TouchOffice catalogue response is unexpectedly small");
}
export function buildCatalogueChanges(existing: Array<{ id: string; plu: number; name: string; active: boolean; needsCategoryReview: boolean; firstSeenAt: Date | null }>, incoming: Array<CatalogueProduct & { locationId: string }>, syncedAt: Date) {
  const byPlu = new Map(existing.map(item => [item.plu, item]));
  const upserts = incoming.map(product => { const prior = byPlu.get(product.plu); return { ...product, active: true, needsCategoryReview: !prior || prior.needsCategoryReview || prior.name !== product.name, firstSeenAt: prior?.firstSeenAt ?? syncedAt, lastSeenAt: syncedAt, lastSuccessfulSyncAt: syncedAt }; });
  const removals = existing.filter(item => !incoming.some(product => product.plu === item.plu) && item.active);
  return { upserts, removals, summary: { added: incoming.filter(item => !byPlu.has(item.plu)).length, renamed: incoming.filter(item => { const prior = byPlu.get(item.plu); return Boolean(prior && prior.name !== item.name); }).length, removed: removals.length, count: incoming.length } };
}
