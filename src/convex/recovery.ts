import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

function enabled() {
  return process.env.ENABLE_TEMP_ADMIN_ACCESS === "true";
}

export const temporaryAccessEnabled = query({
  args: {},
  handler: async () => enabled(),
});

export const claimTemporaryAccess = mutation({
  args: {},
  handler: async (ctx) => {
    if (!enabled()) throw new Error("Temporary access is disabled");

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("You must be signed in");

    const user = await ctx.db.get(userId);
    if (!user?.isAnonymous) throw new Error("Temporary access is only available to anonymous users");

    const existingMemberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (existingMemberships.length) return existingMemberships[0].locationId;

    const location = (await ctx.db.query("locations").collect())
      .filter((item) => item.active)
      .sort((a, b) => a.name.localeCompare(b.name))[0];
    if (!location) throw new Error("No active Le Feast store is configured");

    await ctx.db.insert("memberships", {
      userId,
      locationId: location._id,
      role: "admin",
    });

    return location._id;
  },
});
