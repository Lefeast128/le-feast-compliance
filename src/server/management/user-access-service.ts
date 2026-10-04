import { and, asc, eq, inArray } from "drizzle-orm";
import { normalizeEmail, requireOrganisationAdmin, type AuthContext } from "../auth/core.js";
import { sendInvitationEmail, toResendDeliveryError } from "../auth/resend.js";
import { ApiError } from "../compliance/errors.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";
import { locations, memberships, users } from "../db/schema.js";
import { db, id, type Transaction } from "./shared.js";

export type UserAccessRole = "staff" | "manager";

export type UserAccessLocation = {
  id: string;
  name: string;
  shortName: string;
};

export type UserAccessMembership = UserAccessLocation & {
  membershipId: string;
  role: UserAccessRole;
};

export type UserAccessUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  isSelf: boolean;
  allOrganisationLocations: boolean;
  memberships: UserAccessMembership[];
};

export type UserAccessResponse = {
  currentUserId: string;
  locations: UserAccessLocation[];
  users: UserAccessUser[];
};

type MembershipSelection = {
  locationId: string;
  role: UserAccessRole;
};

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
  return user;
}

async function membershipRowsForUsers(organisationId: string, userIds: string[]) {
  if (!userIds.length) return [];
  return db().select({ membership: memberships, location: locations })
    .from(memberships)
    .innerJoin(locations, eq(locations.id, memberships.locationId))
    .where(and(eq(locations.organisationId, organisationId), inArray(memberships.userId, userIds)));
}

function mapUserAccessUser(
  user: typeof users.$inferSelect,
  rows: Array<{ membership: typeof memberships.$inferSelect; location: typeof locations.$inferSelect }>,
  currentUserId: string,
): UserAccessUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSelf: user.id === currentUserId,
    allOrganisationLocations: user.role === "admin",
    memberships: rows
      .filter(row => row.membership.userId === user.id)
      .sort((left, right) => left.location.name.localeCompare(right.location.name))
      .map(row => ({
        membershipId: row.membership.id,
        id: row.location.id,
        name: row.location.name,
        shortName: row.location.shortName,
        role: row.membership.role,
      })),
  };
}

async function syncMemberships(tx: Transaction, userId: string, desired: MembershipSelection[]) {
  const existing = await tx.select().from(memberships).where(eq(memberships.userId, userId));
  const desiredByLocation = new Map(desired.map(selection => [selection.locationId, selection.role]));
  const existingByLocation = new Map(existing.map(row => [row.locationId, row]));

  for (const row of existing) {
    const desiredRole = desiredByLocation.get(row.locationId);
    if (!desiredRole) await tx.delete(memberships).where(eq(memberships.id, row.id));
    else if (desiredRole !== row.role) await tx.update(memberships).set({ role: desiredRole }).where(eq(memberships.id, row.id));
  }

  for (const selection of desired) {
    if (!existingByLocation.has(selection.locationId)) {
      await tx.insert(memberships).values({ userId, locationId: selection.locationId, role: selection.role });
    }
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
    db().select().from(users).where(eq(users.organisationId, organisationId)).orderBy(asc(users.email)),
  ]);
  const rows = await membershipRowsForUsers(organisationId, userRows.map(user => user.id));
  return {
    currentUserId: context.user.id,
    locations: locationRows,
    users: userRows.map(user => mapUserAccessUser(user, rows, context.user.id)),
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
      await tx.update(users).set({ name, isAnonymous: false }).where(eq(users.id, existing.id));
      await syncMemberships(tx, existing.id, desired);
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
  if (desired) await locationsForOrganisation(organisationId, desired);
  await db().transaction(async tx => {
    if (name !== undefined) await tx.update(users).set({ name }).where(eq(users.id, current.id));
    if (desired) await syncMemberships(tx, current.id, desired);
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
