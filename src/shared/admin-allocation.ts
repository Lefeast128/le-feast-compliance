export type AllocationRow = { locationId: string; active: boolean };

/**
 * A changed central item gets a new active row for the same store while its
 * previous row remains historical. Keep that store out of the insert pass.
 */
export function allocatedStoresMissingActiveRows(
  selectedLocationIds: readonly string[],
  currentRows: readonly AllocationRow[],
  versionedLocationIds: Iterable<string>,
) {
  const activeLocations = new Set(
    currentRows.filter((row) => row.active).map((row) => row.locationId),
  );
  for (const locationId of versionedLocationIds) activeLocations.add(locationId);
  return selectedLocationIds.filter((locationId) => !activeLocations.has(locationId));
}
