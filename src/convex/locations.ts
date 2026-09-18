import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const myLocations = query({ args: {}, handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; const memberships = await ctx.db.query("memberships").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(); const locations = await Promise.all(memberships.map((membership: any) => ctx.db.get(membership.locationId))); return locations.filter(Boolean).filter((location: any) => location.active); } });
