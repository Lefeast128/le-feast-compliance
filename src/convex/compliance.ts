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
    if (existing) {
      const existingLocations = (await ctx.db.query("locations").collect()).filter(location => location.organisationId === existing._id);
      const existingProducts = await ctx.db.query("probeProducts").withIndex("by_organisation", q => q.eq("organisationId", existing._id)).collect();
      if (existingLocations.length && existingProducts.length === 0) {
        const locationIds = existingLocations.map(location => location._id);
        for (const product of ["Sausages", "Bacon", "Hash Browns"]) await ctx.db.insert("probeProducts", { organisationId: existing._id, name: product, minimumTemperature: 76, holdMinutes: 2, locationIds, active: true });
        const openingQuestions = ["Food fridges operating correctly?", "Drinks fridges operating correctly?", "Food-preparation surfaces clean?", "Handwash sink accessible?", "Hot water available?", "Soap available?", "Disposable hand-drying available?", "Food probe available and sanitised?", "Approved chemicals available?", "Allergen information available?", "Food correctly stored and labelled?", "No evidence of pest activity?"];
        const closingQuestions = ["PM temperature checks completed?", "Expired or damaged food removed?", "Open food covered and labelled?", "Chilled food stored safely?", "Food-preparation areas cleaned?", "Equipment and utensils cleaned?", "Waste removed and bins controlled?", "Floors cleaned?", "Chemicals stored correctly?", "Outstanding issues handed over?"];
        const firstLocation = existingLocations[0];
        const existingQuestions = await ctx.db.query("checklistQuestions").withIndex("by_location_checklist", q => q.eq("locationId", firstLocation._id).eq("checklist", "opening")).collect();
        if (existingQuestions.length === 0) for (const [index, question] of openingQuestions.entries()) await ctx.db.insert("checklistQuestions", { locationId: firstLocation._id, checklist: "opening", question, order: index, active: true });
        const existingClosing = await ctx.db.query("checklistQuestions").withIndex("by_location_checklist", q => q.eq("locationId", firstLocation._id).eq("checklist", "closing")).collect();
        if (existingClosing.length === 0) for (const [index, question] of closingQuestions.entries()) await ctx.db.insert("checklistQuestions", { locationId: firstLocation._id, checklist: "closing", question, order: index, active: true });
      }
      return;
    }
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
    for (const product of ["Sausages", "Bacon", "Hash Browns"]) {
      await ctx.db.insert("probeProducts", { organisationId, name: product, minimumTemperature: 76, holdMinutes: 2, locationIds, active: true });
    }
    const openingQuestions = ["Food fridges operating correctly?", "Drinks fridges operating correctly?", "Food-preparation surfaces clean?", "Handwash sink accessible?", "Hot water available?", "Soap available?", "Disposable hand-drying available?", "Food probe available and sanitised?", "Approved chemicals available?", "Allergen information available?", "Food correctly stored and labelled?", "No evidence of pest activity?"];
    const closingQuestions = ["PM temperature checks completed?", "Expired or damaged food removed?", "Open food covered and labelled?", "Chilled food stored safely?", "Food-preparation areas cleaned?", "Equipment and utensils cleaned?", "Waste removed and bins controlled?", "Floors cleaned?", "Chemicals stored correctly?", "Outstanding issues handed over?"];
    for (const [index, question] of openingQuestions.entries()) await ctx.db.insert("checklistQuestions", { locationId: locationIds[0], checklist: "opening", question, order: index, active: true });
    for (const [index, question] of closingQuestions.entries()) await ctx.db.insert("checklistQuestions", { locationId: locationIds[0], checklist: "closing", question, order: index, active: true });
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
    const organisation = await ctx.db.get(location.organisationId);
    const probeProducts = organisation ? (await ctx.db.query("probeProducts").withIndex("by_organisation", q => q.eq("organisationId", organisation._id)).collect()).filter(product => product.active && product.locationIds.includes(locationId)) : [];
    const openingQuestions = await ctx.db.query("checklistQuestions").withIndex("by_location_checklist", q => q.eq("locationId", locationId).eq("checklist", "opening")).collect();
    const closingQuestions = await ctx.db.query("checklistQuestions").withIndex("by_location_checklist", q => q.eq("locationId", locationId).eq("checklist", "closing")).collect();
    const openingResponses = await ctx.db.query("checklistResponses").withIndex("by_location_checklist", q => q.eq("locationId", locationId).eq("checklist", "opening")).collect();
    const closingResponses = await ctx.db.query("checklistResponses").withIndex("by_location_checklist", q => q.eq("locationId", locationId).eq("checklist", "closing")).collect();
    return { location, equipment, tasks, rounds, readings, issues, foodChecks, probeProducts, checklists: { opening: { questions: openingQuestions.sort((a, b) => a.order - b.order), responses: openingResponses }, closing: { questions: closingQuestions.sort((a, b) => a.order - b.order), responses: closingResponses } }, role: (await ctx.db.get(userId))?.role ?? "staff" };
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
    let issueId = null;
    if (result === "fail") {
      const equipment = await ctx.db.get(args.equipmentId);
      issueId = await ctx.db.insert("issues", { locationId: args.locationId, category: "Temperature", title: `${equipment?.name ?? "Fridge"} requires action`, description: `Recorded at ${args.temperature}°C. Le Feast maximum is 8°C.`, status: "open", createdAt: Date.now(), createdBy: userId });
    }
    return { readingId, issueId };
  },
});

export const completeRound = mutation({
  args: { roundId: v.id("temperatureRounds"), locationId: v.id("locations"), session: v.optional(v.union(v.literal("AM"), v.literal("PM"))) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    await ctx.db.patch(args.roundId, { completedAt: Date.now() });
    const tasks = await ctx.db.query("scheduledTasks").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect();
    const sessionTask = tasks.find(t => t.session === (args.session ?? "AM"));
    if (sessionTask) await ctx.db.patch(sessionTask._id, { status: "complete", completedAt: Date.now(), completedBy: userId });
    await ctx.db.insert("auditEvents", { locationId: args.locationId, userId, type: "temperature_round_completed", detail: "Temperature round completed", createdAt: Date.now() });
  },
});

export const recordFoodCheck = mutation({
  args: { locationId: v.id("locations"), product: v.string(), quantity: v.optional(v.string()), temperature: v.number(), action: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const result = args.temperature >= 76 ? "pass" : "fail";
    return await ctx.db.insert("foodChecks", { ...args, result, createdAt: Date.now(), createdBy: userId });
  },
});

export const createManualIssue = mutation({
  args: { locationId: v.id("locations"), description: v.string() },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    return await ctx.db.insert("issues", { locationId: args.locationId, category: "Food safety", title: "Manual issue reported", description: args.description, status: "open", createdAt: Date.now(), createdBy: userId });
  },
});

export const saveChecklistResponse = mutation({
  args: { locationId: v.id("locations"), checklist: v.union(v.literal("opening"), v.literal("closing")), questionId: v.id("checklistQuestions"), answer: v.union(v.literal("yes"), v.literal("no"), v.literal("na")), problem: v.optional(v.string()), action: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    return await ctx.db.insert("checklistResponses", { ...args, createdAt: Date.now(), createdBy: userId });
  },
});

export const addEquipment = mutation({
  args: { locationId: v.id("locations"), name: v.string(), type: v.string(), preferredTemperature: v.optional(v.number()), maximumTemperature: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const equipment = await ctx.db.query("equipment").withIndex("by_location", q => q.eq("locationId", args.locationId)).collect();
    const id = await ctx.db.insert("equipment", { ...args, order: equipment.length, active: true });
    await ctx.db.insert("auditEvents", { locationId: args.locationId, userId, type: "equipment_added", detail: args.name, createdAt: Date.now() });
    return id;
  },
});

export const addProbeProduct = mutation({
  args: { organisationId: v.id("organisations"), name: v.string(), minimumTemperature: v.number(), holdMinutes: v.number(), locationIds: v.array(v.id("locations")) },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const id = await ctx.db.insert("probeProducts", { ...args, active: true });
    await ctx.db.insert("auditEvents", { userId, type: "probe_product_added", detail: args.name, createdAt: Date.now() });
    return id;
  },
});

export const addChecklistQuestion = mutation({
  args: { locationId: v.id("locations"), checklist: v.union(v.literal("opening"), v.literal("closing")), question: v.string() },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const questions = await ctx.db.query("checklistQuestions").withIndex("by_location_checklist", q => q.eq("locationId", args.locationId).eq("checklist", args.checklist)).collect();
    return await ctx.db.insert("checklistQuestions", { ...args, order: questions.length, active: true });
  },
});

export const addIssueAction = mutation({
  args: { issueId: v.id("issues"), action: v.string() },
  handler: async (ctx, args) => {
    const userId = await signedIn(ctx);
    const issue = await ctx.db.get(args.issueId);
    await ctx.db.patch(args.issueId, { action: args.action, status: "monitoring" });
    await ctx.db.insert("auditEvents", { locationId: issue?.locationId, userId, type: "corrective_action_added", detail: args.action, createdAt: Date.now() });
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
