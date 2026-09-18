import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

export const myLocations = query({ args: {}, handler: async (ctx) => { const userId = await getAuthUserId(ctx); if (!userId) return []; return (await ctx.db.query("locations").collect()).filter((location: any) => location.active).sort((a: any, b: any) => a.name.localeCompare(b.name)); } });
