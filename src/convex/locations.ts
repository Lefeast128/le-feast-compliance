import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const myLocations = query({ args: {}, handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; const memberships = await ctx.db.query("memberships").withIndex("by_user", (q: any) => q.eq("userId", userId)).collect(); const allowedLocationIds = new Set(memberships.map((membership: any) => membership.locationId)); return (await ctx.db.query("locations").collect()).filter((location: any) => location.active && allowedLocationIds.has(location._id)).sort((a: any, b: any) => a.name.localeCompare(b.name)); } });
