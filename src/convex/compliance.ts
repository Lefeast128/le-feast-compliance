import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const stores = [
  { name: "Blackpool North", shortName: "Blackpool" },
  { name: "Bolton", shortName: "Bolton" },
  { name: "Poulton-le-Fylde", shortName: "Poulton" },
  { name: "Rochdale", shortName: "Rochdale" },
];
const equipmentNames = ["Sandwich Fridge", "Milk Fridge", "Front Drinks Fridge", "Chilled Display"];

async function signedIn(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("You must be signed in");
  return userId;
}

export const initializeDemo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await signedIn(ctx);
    const existing = await ctx.db.query("organisations").first();
    if (existing) return;
    const organisationId = await ctx.db.insert("organisations", { name: "Le Feast", timezone: "Europe/London" });
    const locationIds: Id<"locations">[] = [];
    for (const [index, store] of stores.entries()) {
      const locationId = await ctx.db.insert("locations", { organisationId, ...store, timezone: "Europe/London", active: true });
      locationIds.push(locationId);
      await ctx.db.insert("memberships", { userId, locationId, role: index === 0 ? "manager" : "admin" });
      for (const [order, name] of equipmentNames.entries()) {
        await ctx.db.insert("equipment", { locationId, name, type: order === 0 ? "Food fridge" : "Chilled display", order, active: true });
      }
      const taskStatus = index === 1 ? "due" : "complete";
      await ctx.db.insert("scheduledTasks", { locationId, title: "AM Fridge Checks", kind: "temperature", session: "AM", dueLabel: "Due by 10:00", status: taskStatus, completedAt: taskStatus === "complete" ? Date.now() - 7200000 : undefined, completedBy: taskStatus === "complete" ? userId : undefined });
      await ctx.db.insert("scheduledTasks", { locationId, title: "PM Fridge Checks", kind: "temperature", session: "PM", dueLabel: "Due at close", status: "upcoming" });
      await ctx.db.insert("scheduledTasks", { locationId, title: "Cooking temperature", kind: "probe", dueLabel: "When first batch is cooked", status: index === 2 ? "complete" : "upcoming", completedAt: index === 2 ? Date.now() - 3600000 : undefined, completedBy: index === 2 ? userId : undefined });
    }
    const blackpoolEquipment = await ctx.db.query("equipment").withIndex("by_location", q => q.eq("locationId", locationIds[0])).collect();
    const roundId = await ctx.db.insert("temperatureRounds", { locationId: locationIds[0], session: "AM", startedAt: Date.now() - 8000000, completedAt: Date.now() - 7800000, createdBy: userId });
    for (const [index, item] of blackpoolEquipment.entries()) {
      await ctx.db.insert("temperatureReadings", { roundId, equipmentId: item._id, locationId: locationIds[0], temperature: [4.2, 3.8, 8.7, 4.6][index], result: index === 2 ? "fail" : "normal", createdAt: Date.now() - 7800000 + index * 30000, createdBy: userId, voided: false });
    }
    await ctx.db.insert("issues", { locationId: locationIds[0], category: "Temperature", title: "Front Drinks Fridge needs attention", description: "Recorded at 8.7°C, above the Le Feast maximum of 8°C.", status: "monitoring", createdAt: Date.now() - 7700000, createdBy: userId, action: "Door checked and drinks moved to the chilled display. Recheck due." });
    await ctx.db.insert("issues", { locationId: locationIds[2], category: "Temperature", title: "Poulton follow-up required", description: "PM temperature round has an open follow-up.", status: "open", createdAt: Date.now() - 2400000, createdBy: userId });
    await ctx.db.insert("foodChecks", { locationId: locationIds[0], product: "Sausages", temperature: 81.2, result: "pass", action: "Held for 2 minutes", createdAt: Date.now() - 3500000, createdBy: userId });
    await ctx.db.patch(userId, { role: "admin", name: "Le Feast Operations" });
  },
});

export const dashboard = query({
  args: { locationId: v.optional(v.id("locations")) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const memberships = await ctx.db.query("memberships").withIndex("by_user", q => q.eq("userId", userId)).collect();
    const locationId = args.locationId ?? memberships[0]?.locationId;
    if (!locationId) return null;
    const location = await ctx.db.get(locationId);
    if (!location) return null;
    const equipment = (await ctx.db.query("equipment").withIndex("by_location", q => q.eq("locationId", locationId)).collect()).filter(item => item.active).sort((a, b) => a.order - b.order);
    const tasks = await ctx.db.query("scheduledTasks").withIndex("by_location", q => q.eq("locationId", locationId)).collect();
    const rounds = await ctx.db.query("temperatureRounds").withIndex("by_location", q => q.eq("locationId", locationId)).collect();
    const readings = await ctx.db.query("temperatureReadings").withIndex("by_location", q => q.eq("locationId", locationId)).collect();
    const issues = await ctx.db.query("issues").withIndex("by_location", q => q.eq("locationId", locationId)).collect();
    const foodChecks = await ctx.db.query("foodChecks").withIndex("by_location", q => q.eq("locationId", locationId)).collect();
    return { location, equipment, tasks, rounds, readings, issues, foodChecks, role: (await ctx.db.get(userId))?.role ?? "staff" };
  },
});

export const operations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await signedIn(ctx);
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Operations access required");
    const locations = await ctx.db.query("locations").collect();
    const result = [];
    for (const location of locations) {
      const tasks = await ctx.db.query("scheduledTasks").withIndex("by_location", q => q.eq("locationId", location._id)).collect();
      const issues = await ctx.db.query("issues").withIndex("by_location", q => q.eq("locationId", location._id)).collect();
      result.push({ location, total: tasks.length, complete: tasks.filter(t => t.status === "complete").length, outstanding: tasks.filter(t => t.status !== "complete").length, issues: issues.filter(i => i.status !== "resolved").length, latestIssue: issues.filter(i => i.status !== "resolved").sort((a, b) => b.createdAt - a.createdAt)[0] });
    }
    return result;
  },
});

export const startRound = mutation({
  args: { locationId: v.id("locations"), session: v.union(v.literal("AM"), v.literal("PM")) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    return await ctx.db.insert("temperatureRounds", { ...args, startedAt: Date.now(), createdBy: userId });
  },
});

export const recordTemperature = mutation({
  args: { roundId: v.id("temperatureRounds"), locationId: v.id("locations"), equipmentId: v.id("equipment"), temperature: v.number() },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const result = args.temperature > 8 ? "fail" : args.temperature > 5 ? "within_limit" : "normal";
    const readingId = await ctx.db.insert("temperatureReadings", { ...args, result, createdAt: Date.now(), createdBy: userId, voided: false });
    if (result === "fail") {
      const equipment = await ctx.db.get(args.equipmentId);
      await ctx.db.insert("issues", { locationId: args.locationId, category: "Temperature", title: `${equipment?.name ?? "Fridge"} requires action`, description: `Recorded at ${args.temperature}°C. Le Feast maximum is 8°C.`, status: "open", createdAt: Date.now(), createdBy: userId });
    }
    return readingId;
  },
});

export const completeRound = mutation({
  args: { roundId: v.id("temperatureRounds"), locationId: v.id("locations") },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    await ctx.db.patch(args.roundId, { completedAt: Date.now() });
    const tasks = await ctx.db.query("scheduledTasks").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect();
    const amTask = tasks.find(t => t.session === "AM");
    if (amTask) await ctx.db.patch(amTask._id, { status: "complete", completedAt: Date.now(), completedBy: userId });
    await ctx.db.insert("auditEvents", { locationId: args.locationId, userId, type: "temperature_round_completed", detail: "Temperature round completed", createdAt: Date.now() });
  },
});

export const recordFoodCheck = mutation({
  args: { locationId: v.id("locations"), product: v.string(), temperature: v.number(), action: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const result = args.temperature >= 76 ? "pass" : "fail";
    return await ctx.db.insert("foodChecks", { ...args, result, createdAt: Date.now(), createdBy: userId });
  },
});

export const resolveIssue = mutation({
  args: { issueId: v.id("issues"), action: v.string() },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    await ctx.db.patch(args.issueId, { action: args.action, status: "resolved", resolvedAt: Date.now() });
    const issue = await ctx.db.get(args.issueId);
    await ctx.db.insert("auditEvents", { locationId: issue?.locationId, userId, type: "issue_resolved", detail: args.action, createdAt: Date.now() });
  },
});
