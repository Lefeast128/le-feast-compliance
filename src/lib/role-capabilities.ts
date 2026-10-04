import type { AuthMembership, AuthUser } from "@/lib/api-client";

export type RoleCapabilities = {
  isOrganisationAdmin: boolean;
  canUseManagement: boolean;
  canManageUserAccess: boolean;
  canViewManagerReviews: boolean;
};

export function canManageLocation(
  user: AuthUser | null,
  memberships: AuthMembership[],
  locationId: string | null | undefined,
) {
  if (!user || !locationId) return false;
  return user.role === "admin" || memberships.some(
    membership => membership.locationId === locationId && membership.role === "manager",
  );
}

export function getRoleCapabilities(
  user: AuthUser | null,
  memberships: AuthMembership[],
  locationId?: string | null,
): RoleCapabilities {
  const isOrganisationAdmin = user?.role === "admin";
  const canManage = isOrganisationAdmin || canManageLocation(user, memberships, locationId);
  return {
    isOrganisationAdmin,
    canUseManagement: canManage,
    canManageUserAccess: isOrganisationAdmin,
    canViewManagerReviews: canManage,
  };
}

