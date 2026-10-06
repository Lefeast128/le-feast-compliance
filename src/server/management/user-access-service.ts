import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { normalizeEmail, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { sendInvitationEmail, toResendDeliveryError } from "../auth/resend.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";
import { auditEvents, authSessions, locations, memberships, users } from "../db/schema.js";
import { db, id, type Transaction } from "./shared.js";

export type UserAccessRole = "staff" | "manager";

export type UserAccessLocation = {
  id: string;
  name: string;
  shortName: string;
};

export type UserAccessMembership = UserAccessLocation & {
  locationId: string;
  membershipId: string;
  role: UserAccessRole;
};

export type UserAccessUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  isPendingInvite: boolean;
  isSelf: boolean;
  allOrganisationLocations: boolean;
  memberships: UserAccessMembership[];
};

export type UserAccessResponse = {
  currentUserId: string;
  locations: UserAccessLocation[];
  users: UserAccessUser[];
  accessHistory: AccessHistoryEntry[];
};

export type AccessHistoryEntry = {
  occurredAt: string;
  adminName: string;
  userName: string;
  userEmail: string;
  change: string;
};

type MembershipSelection = {
  locationId: string;
  role: UserAccessRole;
};

type MembershipChange = {
  kind: "added" | "removed" | "role_changed";
  locationId: string;
  oldRole?: UserAccessRole;
  newRole?: UserAccessRole;
};

const ACCESS_AUDIT_TYPES = [
  "user_access_invited",
  "user_access_added",
  "user_access_removed",
  "user_access_role_changed",
  "user_access_updated",
  "user_login_removed",
] as const;

export class UserAccessDeliveryError extends Error {
  readonly accessCreated: boolean;

  constructor(message: string, accessCreated: boolean) {
    super(message);
    this.name = "UserAccessDeliveryError";
    this.accessCreated = accessCreated;
  }
}

const invitationFailure = (accessCreated: boolean) => new UserAccessDeliveryError(
  accessCreated
    ? "User access was created but invitation email could not be delivered."
    : "Invitation email could not be delivered.",
  accessCreated,
);

function organisationIdFor(context: AuthContext) {
  const organisationId = context.user.organisationId;
  if (!organisationId) throw new ApiError(403, "Access denied");
  requireOrganisationAdmin(context, organisationId);
  return organisationId;
}

function userName(value: unknown) {
  return requireString(value, "Name");
}

function email(value: unknown) {
  const normalized = normalizeEmail(requireString(value, "Email"));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new ApiError(400, "Email is invalid");
  return normalized;
}

function displayName(user: typeof users.$inferSelect) {
  if (user.name) return user.name;
  if (user.email === "brenden@lefeast.co.uk" && user.role === "admin") return "Brenden Wilkinson";
  return null;
}

function membershipSelections(value: unknown, required: boolean): MembershipSelection[] | undefined {
  if (value === undefined && !required) return undefined;
  if (!Array.isArray(value)) throw new ApiError(400, "Store access is invalid");
  const selections = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new ApiError(400, `Store access ${index + 1} is invalid`);
    const record = item as Record<string, unknown>;
    return {
      locationId: requireUuid(record.locationId, "locationId"),
      role: requireEnum(record.role, "role", ["staff", "manager"] as const),
    };
  });
  if (new Set(selections.map(selection => selection.locationId)).size !== selections.length) {
    throw new ApiError(400, "Store access contains a duplicate store");
  }
  return selections;
}

async function locationsForOrganisation(organisationId: string, selections: MembershipSelection[] = []) {
  const requestedIds = selections.map(selection => selection.locationId);
  if (!requestedIds.length) return [];
  const rows = await db().select({ id: locations.id, name: locations.name, shortName: locations.shortName })
    .from(locations)
    .where(and(eq(locations.organisationId, organisationId), eq(locations.active, true), inArray(locations.id, requestedIds)));
  if (rows.length !== requestedIds.length) throw new ApiError(400, "One or more stores are not available");
  return rows;
}

async function ensureOrdinaryUser(context: AuthContext, userId: string, organisationId: string) {
  const [user] = await db().select().from(users).where(and(eq(users.id, userId), eq(users.organisationId, organisationId))).limit(1);
  if (!user) throw new ApiError(404, "User not found");
  if (user.role === "admin" || user.id === context.user.id) throw new ApiError(409, "Organisation administrator access cannot be modified here");
  if (!user.active) throw new ApiError(404, "User not found");
  return user;
}

async function membershipRowsForUsers(organisationId: string, userIds: string[]) {
  if (!userIds.length) return [];
  return db().select({ membership: memberships, location: locations })
    .from(memberships)
    .innerJoin(locations, eq(locations.id, memberships.locationId))
    .where(and(eq(locations.organisationId, organisationId), inArray(memberships.userId, userIds)));
}

function accessAuditDetail(input: {
  userName: string;
  userEmail: string;
  storeName?: string;
  oldRole?: UserAccessRole;
  newRole?: UserAccessRole;
  oldStores?: string[];
  newStores?: string[];
}) {
  return JSON.stringify({
    userName: input.userName,
    userEmail: input.userEmail,
    storeName: input.storeName,
    oldRole: input.oldRole,
    newRole: input.newRole,
    oldStores: input.oldStores,
    newStores: input.newStores,
  });
}

async function recordAccessAudit(
  tx: Transaction,
  context: AuthContext,
  type: (typeof ACCESS_AUDIT_TYPES)[number],
  locationId: string | null,
  detail: string,
) {
  await tx.insert(auditEvents).values({
    locationId,
    userId: context.user.id,
    type,
    detail,
    createdAt: new Date(),
  });
}

function locationNameMap(rows: Array<{ id: string; name: string }>) {
  return new Map(rows.map(row => [row.id, row.name]));
}

function mapUserAccessUser(
  user: typeof users.$inferSelect,
  rows: Array<{ membership: typeof memberships.$inferSelect; location: typeof locations.$inferSelect }>,
  currentUserId: string,
): UserAccessUser {
  return {
    id: user.id,
    name: displayName(user),
    email: user.email,
    role: user.role,
    isPendingInvite: user.role === "user" && !user.emailVerifiedAt && !user.passwordHash,
    isSelf: user.id === currentUserId,
    allOrganisationLocations: user.role === "admin",
    memberships: rows
      .filter(row => row.membership.userId === user.id)
      .sort((left, right) => left.location.name.localeCompare(right.location.name))
      .map(row => ({
        membershipId: row.membership.id,
        locationId: row.location.id,
        id: row.location.id,
        name: row.location.name,
        shortName: row.location.shortName,
        role: row.membership.role,
      })),
  };
}

async function syncMemberships(tx: Transaction, userId: string, desired: MembershipSelection[]) {
  const changes: MembershipChange[] = [];
  const existing = await tx.select().from(memberships).where(eq(memberships.userId, userId));
  const desiredByLocation = new Map(desired.map(selection => [selection.locationId, selection.role]));
  const existingByLocation = new Map(existing.map(row => [row.locationId, row]));

  for (const row of existing) {
    const desiredRole = desiredByLocation.get(row.locationId);
    if (!desiredRole) {
      await tx.delete(memberships).where(eq(memberships.id, row.id));
      changes.push({ kind: "removed", locationId: row.locationId, oldRole: row.role });
    } else if (desiredRole !== row.role) {
      await tx.update(memberships).set({ role: desiredRole }).where(eq(memberships.id, row.id));
      changes.push({ kind: "role_changed", locationId: row.locationId, oldRole: row.role, newRole: desiredRole });
    }
  }

  for (const selection of desired) {
    if (!existingByLocation.has(selection.locationId)) {
      await tx.insert(memberships).values({ userId, locationId: selection.locationId, role: selection.role });
      changes.push({ kind: "added", locationId: selection.locationId, newRole: selection.role });
    }
  }
  return changes;
}

async function recordMembershipAudits(
  tx: Transaction,
  context: AuthContext,
  user: { name: string | null; email: string },
  changes: MembershipChange[],
  names: Map<string, string>,
) {
  for (const change of changes) {
    const type = change.kind === "added"
      ? "user_access_added"
      : change.kind === "removed"
        ? "user_access_removed"
        : "user_access_role_changed";
    await recordAccessAudit(
      tx,
      context,
      type,
      change.locationId,
      accessAuditDetail({
        userName: user.name ?? user.email,
        userEmail: user.email,
        storeName: names.get(change.locationId),
        oldRole: change.oldRole,
        newRole: change.newRole,
      }),
    );
  }
}

async function sendInvite(input: { email: string; name: string; inviterName: string | null; locations: UserAccessLocation[]; accessCreated: boolean }) {
  try {
    await sendInvitationEmail({
      email: input.email,
      recipientName: input.name,
      inviterName: input.inviterName,
      locations: input.locations.map(location => location.name),
    });
  } catch (error) {
    const resendError = toResendDeliveryError(error);
    console.error("User access invitation delivery failed", { status: resendError.status, code: resendError.code });
    throw invitationFailure(input.accessCreated);
  }
}

export async function listUserAccess(context: AuthContext): Promise<UserAccessResponse> {
  const organisationId = organisationIdFor(context);
  const [locationRows, userRows] = await Promise.all([
    db().select({ id: locations.id, name: locations.name, shortName: locations.shortName })
      .from(locations)
      .where(and(eq(locations.organisationId, organisationId), eq(locations.active, true)))
      .orderBy(asc(locations.name)),
    db().select().from(users).where(and(eq(users.organisationId, organisationId), eq(users.active, true))).orderBy(asc(users.email)),
  ]);
  const rows = await membershipRowsForUsers(organisationId, userRows.map(user => user.id));
  const historyRows = await db().select({ event: auditEvents, admin: users, location: locations })
    .from(auditEvents)
    .innerJoin(users, eq(users.id, auditEvents.userId))
    .leftJoin(locations, eq(locations.id, auditEvents.locationId))
    .where(and(eq(users.organisationId, organisationId), inArray(auditEvents.type, [...ACCESS_AUDIT_TYPES])))
    .orderBy(asc(auditEvents.createdAt));
  const accessHistory = historyRows.reverse().slice(0, 50).map(row => {
    let detail: { userName?: string; userEmail?: string; storeName?: string; oldRole?: UserAccessRole; newRole?: UserAccessRole } = {};
    try { detail = JSON.parse(row.event.detail) as typeof detail; } catch { /* preserve older audit entries */ }
    const roleChange = detail.oldRole && detail.newRole ? `${detail.oldRole === "manager" ? "Manager" : "Staff"} → ${detail.newRole === "manager" ? "Manager" : "Staff"}` : null;
    const change = row.event.type === "user_access_invited"
      ? `User invited${detail.storeName ? ` with ${detail.storeName} access` : ""}`
      : row.event.type === "user_access_added"
        ? `${detail.storeName ?? row.location?.name ?? "Store"} access added${detail.newRole ? ` (${detail.newRole === "manager" ? "Manager" : "Staff"})` : ""}`
        : row.event.type === "user_access_removed"
          ? `${detail.storeName ?? row.location?.name ?? "Store"} access removed`
      : row.event.type === "user_access_role_changed"
        ? `${detail.storeName ?? row.location?.name ?? "Store"} access changed: ${roleChange ?? "role updated"}`
        : row.event.type === "user_login_removed"
          ? "Login access removed; historical records preserved"
        : "User access updated";
    return {
      occurredAt: row.event.createdAt.toISOString(),
      adminName: row.admin.name ?? row.admin.email,
      userName: detail.userName ?? "User",
      userEmail: detail.userEmail ?? "",
      change,
    };
  });
  return {
    currentUserId: context.user.id,
    locations: locationRows,
    users: userRows.map(user => mapUserAccessUser(user, rows, context.user.id)),
    accessHistory,
  };
}

export async function inviteUser(context: AuthContext, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const name = userName(input.name);
  const normalizedEmail = email(input.email);
  const role = requireEnum(input.role, "role", ["staff", "manager"] as const);
  const locationIds = membershipSelections(input.locations, true) ?? [];
  if (!locationIds.length) throw new ApiError(400, "At least one store is required");
  const availableLocations = await locationsForOrganisation(organisationId, locationIds);
  const desired = locationIds.map(selection => ({ locationId: selection.locationId, role }));
  const [existing] = await db().select().from(users).where(eq(users.normalizedEmail, normalizedEmail)).limit(1);

  if (existing && existing.organisationId !== organisationId) throw new ApiError(409, "Unable to create user access");
  if (existing && existing.id === context.user.id) throw new ApiError(409, "Organisation administrator access cannot be modified here");
  if (existing && existing.role === "admin") throw new ApiError(409, "Organisation administrator access cannot be modified here");

  const user = await db().transaction(async tx => {
    if (existing) {
      await tx.update(users).set({ name, isAnonymous: false, active: true, deactivatedAt: null }).where(eq(users.id, existing.id));
      const changes = await syncMemberships(tx, existing.id, desired);
      await recordMembershipAudits(tx, context, { name, email: existing.email }, changes, locationNameMap(availableLocations));
      if (existing.name !== name) {
        await recordAccessAudit(tx, context, "user_access_updated", availableLocations[0]?.id ?? null, accessAuditDetail({ userName: name, userEmail: existing.email, oldStores: [], newStores: availableLocations.map(location => location.name) }));
      }
      const [updated] = await tx.select().from(users).where(eq(users.id, existing.id)).limit(1);
      return updated;
    }
    const [created] = await tx.insert(users).values({
      organisationId,
      email: normalizedEmail,
      normalizedEmail,
      name,
      role: "user",
      emailVerifiedAt: null,
      isAnonymous: false,
    }).returning();
    await syncMemberships(tx, created.id, desired);
    for (const location of availableLocations) {
      await recordAccessAudit(tx, context, "user_access_invited", location.id, accessAuditDetail({ userName: name, userEmail: normalizedEmail, storeName: location.name, newRole: role }));
    }
    return created;
  });

  await sendInvite({ email: user.email, name: user.name ?? name, inviterName: context.user.name, locations: availableLocations, accessCreated: true });
  return { user: { id: user.id, email: user.email, name: user.name, role: user.role }, memberships: desired };
}

export async function updateUserAccess(context: AuthContext, userId: string, input: Record<string, unknown>) {
  const organisationId = organisationIdFor(context);
  const current = await ensureOrdinaryUser(context, id(userId, "userId"), organisationId);
  const name = input.name === undefined ? undefined : userName(input.name);
  const desired = membershipSelections(input.memberships, false);
  const desiredLocations = desired ? await locationsForOrganisation(organisationId, desired) : [];
  await db().transaction(async tx => {
    if (name !== undefined) await tx.update(users).set({ name }).where(eq(users.id, current.id));
    if (desired) {
      const changes = await syncMemberships(tx, current.id, desired);
      await recordMembershipAudits(tx, context, { name: name ?? current.name, email: current.email }, changes, locationNameMap(desiredLocations));
      if (name !== undefined && name !== current.name) {
        await recordAccessAudit(tx, context, "user_access_updated", desiredLocations[0]?.id ?? null, accessAuditDetail({ userName: name, userEmail: current.email, oldStores: [], newStores: desiredLocations.map(location => location.name) }));
      }
    } else if (name !== undefined && name !== current.name) {
      await recordAccessAudit(tx, context, "user_access_updated", null, accessAuditDetail({ userName: name, userEmail: current.email }));
    }
  });
  return { id: current.id, name: name ?? current.name, memberships: desired };
}

export async function resendUserInvitation(context: AuthContext, userId: string) {
  const organisationId = organisationIdFor(context);
  const user = await ensureOrdinaryUser(context, id(userId, "userId"), organisationId);
  const rows = await membershipRowsForUsers(organisationId, [user.id]);
  const invitedLocations = rows.map(row => ({ id: row.location.id, name: row.location.name, shortName: row.location.shortName }));
  if (!invitedLocations.length) throw new ApiError(400, "User has no store access");
  await sendInvite({ email: user.email, name: user.name ?? user.email, inviterName: context.user.name, locations: invitedLocations, accessCreated: false });
  return { userId: user.id, sent: true };
}

export async function removeUserAccess(context: AuthContext, userId: string) {
  const organisationId = organisationIdFor(context);
  const current = await ensureOrdinaryUser(context, id(userId, "userId"), organisationId);
  const rows = await membershipRowsForUsers(organisationId, [current.id]);
  const stores = rows.map(row => row.location.name);
  const detail = accessAuditDetail({
    userName: current.name ?? current.email,
    userEmail: current.email,
    oldStores: stores,
  });

  await db().transaction(async tx => {
    for (const row of rows) {
      await tx.delete(memberships).where(eq(memberships.id, row.membership.id));
      await recordAccessAudit(tx, context, "user_access_removed", row.location.id, detail);
    }
    await tx.update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, current.id), isNull(authSessions.revokedAt)));
    await tx.update(users)
      .set({ active: false, deactivatedAt: new Date() })
      .where(eq(users.id, current.id));
    await recordAccessAudit(tx, context, "user_login_removed", null, detail);
  });

  return { userId: current.id, removed: true, membershipsRemoved: rows.length };
}
