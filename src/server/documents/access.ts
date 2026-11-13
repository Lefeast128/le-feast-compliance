import { ApiError } from "../compliance/errors.js";

export type ControlledDocumentAccess = {
  organisationId: string;
  allocationMode: "all" | "selected";
  locationIds: string[];
};

/**
 * Controlled documents must always be authorized against the requested store.
 * The document's upload/source store is not an allocation decision.
 */
export function assertControlledDocumentAccess(
  document: ControlledDocumentAccess,
  requestedLocationId: string | undefined,
  requestingOrganisationId: string,
): asserts requestedLocationId is string {
  if (!requestedLocationId) throw new ApiError(403, "Document location is required");
  if (document.organisationId !== requestingOrganisationId) throw new ApiError(403, "Document access denied");
  if (document.allocationMode !== "all" && !document.locationIds.includes(requestedLocationId)) {
    throw new ApiError(403, "Document access denied");
  }
}
