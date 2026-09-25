export const TOUCHOFFICE_SITE_LOCATION_KEYS = {
  "1": "blackpool",
  "2": "poulton",
  "3": "rochdale",
  "4": "bolton",
} as const;

export type CatalogueProduct = {
  siteId: string;
  plu: number;
  name: string;
  department?: string;
  group?: string;
  valueSources: {
    name: "store" | "head_office" | "missing";
    department: "store" | "head_office" | "missing";
    group: "store" | "head_office" | "missing";
  };
};

export type ComplianceLocation = {
  _id: string;
  name: string;
  shortName: string;
};

const MIN_CATALOGUE_COMPLETENESS_RATIO = 0.5;

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object";
}

function optionalText(value: unknown, field: string, index: number) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error(`Catalogue product ${index} has an invalid ${field}`);
  }
  return value;
}

function sourceValue(value: unknown, field: string, index: number) {
  if (value !== "store" && value !== "head_office" && value !== "missing") {
    throw new Error(`Catalogue product ${index} has an invalid ${field} source`);
  }
  return value as "store" | "head_office" | "missing";
}

export function normalizeCataloguePayload(payload: unknown) {
  if (!isRecord(payload) || payload.ok !== true || !Array.isArray(payload.products)) {
    throw new Error("TouchOffice catalogue response is incomplete");
  }

  if (typeof payload.retrievedAt !== "string" || !payload.retrievedAt.trim()) {
    throw new Error("TouchOffice catalogue response has no retrieval time");
  }

  const seen = new Set<string>();
  const products: CatalogueProduct[] = payload.products.map((rawProduct, index) => {
    if (!isRecord(rawProduct)) {
      throw new Error(`Catalogue product ${index} is invalid`);
    }

    const siteId = String(rawProduct.storeId ?? "");
    if (!(siteId in TOUCHOFFICE_SITE_LOCATION_KEYS)) {
      throw new Error(`Catalogue product ${index} has an unknown store`);
    }

    const plu = Number(rawProduct.plu);
    if (!Number.isInteger(plu) || plu < 1) {
      throw new Error(`Catalogue product ${index} has an invalid PLU`);
    }

    if (typeof rawProduct.name !== "string" || !rawProduct.name.trim()) {
      throw new Error(`Catalogue product ${index} has no name`);
    }

    const key = `${siteId}:${plu}`;
    if (seen.has(key)) throw new Error(`Duplicate TouchOffice product ${key}`);
    seen.add(key);

    const sources = isRecord(rawProduct.valueSources) ? rawProduct.valueSources : {};
    return {
      siteId,
      plu,
      name: rawProduct.name,
      department: optionalText(rawProduct.department, "department", index),
      group: optionalText(rawProduct.group, "group", index),
      valueSources: {
        name: sourceValue(sources.name, "name", index),
        department: sourceValue(sources.department, "department", index),
        group: sourceValue(sources.group, "group", index),
      },
    };
  });

  for (const siteId of Object.keys(TOUCHOFFICE_SITE_LOCATION_KEYS)) {
    if (!products.some(product => product.siteId === siteId)) {
      throw new Error(`TouchOffice catalogue is missing store ${siteId}`);
    }
  }

  return {
    retrievedAt: payload.retrievedAt,
    products,
  };
}

function normaliseLocation(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function mapCatalogueToLocations(
  products: CatalogueProduct[],
  locations: ComplianceLocation[],
) {
  const locationsBySite = new Map<string, ComplianceLocation>();

  for (const [siteId, locationKey] of Object.entries(TOUCHOFFICE_SITE_LOCATION_KEYS)) {
    const matches = locations.filter(location => {
      const name = normaliseLocation(location.name);
      const shortName = normaliseLocation(location.shortName);
      return name === locationKey || shortName === locationKey || name.includes(locationKey);
    });
    if (matches.length !== 1) {
      throw new Error(`TouchOffice store ${siteId} could not be mapped to one compliance location`);
    }
    locationsBySite.set(siteId, matches[0]);
  }

  return products.map(product => {
    const location = locationsBySite.get(product.siteId);
    if (!location) throw new Error(`TouchOffice store ${product.siteId} has no compliance location`);
    return { ...product, locationId: location._id };
  });
}

export function assertCatalogueSize(
  existing: Array<{ active: boolean }>,
  incoming: unknown[],
) {
  const activeCount = existing.filter(product => product.active).length;
  const minimumExpected = Math.ceil(
    activeCount * MIN_CATALOGUE_COMPLETENESS_RATIO,
  );

  if (activeCount > 0 && incoming.length < minimumExpected) {
    throw new Error("TouchOffice catalogue response is unexpectedly small");
  }
}

export function buildCatalogueChanges(
  existing: Array<{
    _id: string;
    plu: number;
    name: string;
    active: boolean;
    needsCategoryReview: boolean;
    firstSeenAt: number;
  }>,
  incoming: Array<CatalogueProduct & { locationId: string }>,
  syncedAt: number,
) {
  const existingByPlu = new Map(existing.map(product => [product.plu, product]));
  const incomingPlu = new Set(incoming.map(product => product.plu));
  const upserts = incoming.map(product => {
    const prior = existingByPlu.get(product.plu);
    return {
      ...product,
      active: true,
      needsCategoryReview:
        !prior || prior.needsCategoryReview || prior.name !== product.name,
      firstSeenAt: prior?.firstSeenAt ?? syncedAt,
      lastSeenAt: syncedAt,
      lastSuccessfulSyncAt: syncedAt,
    };
  });
  const removals = existing
    .filter(product => !incomingPlu.has(product.plu) && product.active)
    .map(product => ({ _id: product._id, lastSuccessfulSyncAt: syncedAt }));

  return {
    upserts,
    removals,
    summary: {
      added: incoming.filter(product => !existingByPlu.has(product.plu)).length,
      renamed: incoming.filter(product => {
        const prior = existingByPlu.get(product.plu);
        return Boolean(prior && prior.name !== product.name);
      }).length,
      removed: removals.length,
      count: incoming.length,
    },
  };
}
