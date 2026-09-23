import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function requireSignedIn(ctx: AuthCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  return userId;
}

export async function requireLocationAccess(
  ctx: AuthCtx,
  locationId: Id<"locations">,
) {
  const userId = await requireSignedIn(ctx);
  const membership = (await ctx.db
    .query("memberships")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect()
  ).find((item) => item.locationId === locationId);

  if (!membership) throw new Error("You do not have access to this location");
  return membership;
}

export async function requireLocationManager(
  ctx: AuthCtx,
  locationId: Id<"locations">,
) {
  const membership = await requireLocationAccess(ctx, locationId);
  if (membership.role !== "manager" && membership.role !== "admin") {
    throw new Error("Manager access required");
  }
  return membership;
}

export async function requireLocationAdmin(
  ctx: AuthCtx,
  locationId: Id<"locations">,
) {
  const membership = await requireLocationAccess(ctx, locationId);
  if (membership.role !== "admin") {
    throw new Error("Admin access required");
  }
  return membership;
}
