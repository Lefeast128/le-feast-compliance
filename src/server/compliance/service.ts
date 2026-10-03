/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  auditEvents,
  checklistQuestions,
  checklistResponses,
  checklistSignOffs,
  catalogueProducts,
  cleaningCompletions,
  cleaningTasks,
  equipment,
  foodChecks,
  issueUpdates,
  issues,
  locations,
  probeProducts,
  rechecks,
  scheduledTasks,
  securityQuestions,
  securityResponses,
  securitySignOffs,
  temperatureReadings,
  temperatureRounds,
  teamMembers,
  wastageItems,
  wastageRecords,
} from "../db/schema.js";
import { requireLocationAccess, type AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { equipmentApplicableAtRound, localDateKey, localDayRange, probeResult, requireEnum, requireFiniteNumber, requirePositiveNumberString, requireString, requireUuid, temperatureResult } from "./validation.js";
import { assertCatalogueProductUsable, catalogueWastageSnapshot, parseWastageMode } from "../wastage/catalogue.js";

const now = () => new Date();

async function locationFor(context: AuthContext, locationId: string, active = true) {
  requireUuid(locationId, "locationId");
  const db = getDb();
  const rows = await db.select().from(locations).where(eq(locations.id, locationId)).limit(1);
  const location = rows[0];
  if (!location || (active && !location.active)) throw new ApiError(404, "Location not found");
  requireLocationAccess(context, location.id, location.organisationId);
  return location;
}

async function activeMember(locationId: string, memberId: string) {
  requireUuid(memberId, "teamMemberId");
  const db = getDb();
  const rows = await db.select().from(teamMembers).where(and(eq(teamMembers.id, memberId), eq(teamMembers.locationId, locationId))).limit(1);
  const member = rows[0];
  if (!member) throw new ApiError(422, "Team member does not belong to this location");
  if (!member.active) throw new ApiError(422, "Team member is inactive");
  return member;
}

export async function startRound(context: AuthContext, input: { locationId: string; session: "AM" | "PM"; teamMemberId?: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  const location = await locationFor(context, input.locationId);
  const db = getDb();
  const timestamp = now();
  if (input.teamMemberId) await activeMember(input.locationId, input.teamMemberId);
  const existing = await db.select().from(temperatureRounds).where(and(eq(temperatureRounds.locationId, location.id), eq(temperatureRounds.session, input.session), isNull(temperatureRounds.completedAt)));
  for (const round of existing) {
    if (localDateKey(round.startedAt.getTime(), location.timezone) !== localDateKey(timestamp.getTime(), location.timezone)) continue;
    const readings = await db.select({ id: temperatureReadings.id }).from(temperatureReadings).where(eq(temperatureReadings.roundId, round.id));
    if (readings.length === 0) await db.delete(temperatureRounds).where(eq(temperatureRounds.id, round.id));
  }
  const [round] = await db.insert(temperatureRounds).values({ locationId: location.id, session: input.session, startedAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId ?? null }).returning({ id: temperatureRounds.id });
  return { roundId: round.id, startedAt: timestamp.toISOString() };
}

export async function recordTemperature(context: AuthContext, input: { roundId: string; locationId: string; equipmentId: string; temperature: number; teamMemberId: string }) {
  requireUuid(input.roundId, "roundId"); requireUuid(input.equipmentId, "equipmentId");
  const location = await locationFor(context, input.locationId);
  requireFiniteNumber(input.temperature, "temperature");
  await activeMember(input.locationId, input.teamMemberId);
  const db = getDb();
  return db.transaction(async (tx: any) => {
    const roundRows = await tx.select().from(temperatureRounds).where(and(eq(temperatureRounds.id, input.roundId), eq(temperatureRounds.locationId, location.id))).limit(1);
    const round = roundRows[0];
    if (!round) throw new ApiError(404, "Round not found");
    if (round.completedAt) throw new ApiError(409, "Temperature round is already complete");
    const equipmentRows = await tx.select().from(equipment).where(and(eq(equipment.id, input.equipmentId), eq(equipment.locationId, location.id))).limit(1);
    const item = equipmentRows[0];
    if (!item) throw new ApiError(422, "Equipment does not belong to this location");
    if (!equipmentApplicableAtRound(item.createdAt, item.deactivatedAt, round.startedAt)) throw new ApiError(422, "Fridge was not configured for this temperature round");
    const existing = await tx.select({ id: temperatureReadings.id }).from(temperatureReadings).where(and(eq(temperatureReadings.roundId, round.id), eq(temperatureReadings.equipmentId, item.id), eq(temperatureReadings.voided, false))).limit(1);
    if (existing.length) throw new ApiError(409, "This fridge already has a reading in this round");
    const preferred = item.preferredTemperature ?? 5;
    const maximum = item.maximumTemperature ?? 8;
    const result = temperatureResult(input.temperature, preferred, maximum);
    const createdAt = now();
    const [reading] = await tx.insert(temperatureReadings).values({ roundId: round.id, equipmentId: item.id, locationId: location.id, temperature: input.temperature, result, createdAt, createdBy: context.user.id, teamMemberId: input.teamMemberId, voided: false, equipmentName: item.name, preferredTemperature: preferred, maximumTemperature: maximum }).onConflictDoNothing({ target: [temperatureReadings.roundId, temperatureReadings.equipmentId, temperatureReadings.voided] }).returning({ id: temperatureReadings.id });
    if (!reading) throw new ApiError(409, "This fridge already has a reading in this round");
    let issueId: string | null = null;
    if (result === "fail") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Temperature", title: `${item.name} requires action`, description: `Recorded at ${input.temperature}°C. The configured maximum is ${maximum}°C.`, originalReading: `${input.temperature}°C`, sourceTemperatureReadingId: reading.id, status: "open", createdAt, createdBy: context.user.id, teamMemberId: input.teamMemberId }).returning({ id: issues.id });
      issueId = issue.id;
    }
    return { readingId: reading.id, issueId, result, preferredTemperature: preferred, maximumTemperature: maximum };
  });
}

export async function completeRound(context: AuthContext, input: { roundId: string; locationId: string; session: "AM" | "PM"; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  requireUuid(input.roundId, "roundId");
  const location = await locationFor(context, input.locationId);
  await activeMember(input.locationId, input.teamMemberId);
  const db = getDb();
  return db.transaction(async (tx: any) => {
    const [round] = await tx.select().from(temperatureRounds).where(and(eq(temperatureRounds.id, input.roundId), eq(temperatureRounds.locationId, location.id))).limit(1);
    if (!round) throw new ApiError(404, "Round not found");
    if (round.completedAt) return { completed: true, roundId: round.id };
    if (round.session !== input.session) throw new ApiError(422, "Round session does not match");
    const allEquipment = await tx.select().from(equipment).where(eq(equipment.locationId, location.id));
    const required = allEquipment.filter((item: any) => equipmentApplicableAtRound(item.createdAt, item.deactivatedAt, round.startedAt));
    const readings = await tx.select().from(temperatureReadings).where(and(eq(temperatureReadings.roundId, round.id), eq(temperatureReadings.voided, false)));
    const readingIds = new Set(readings.map((reading: any) => reading.equipmentId));
    if (required.some((item: any) => !readingIds.has(item.id))) throw new ApiError(422, "Every active fridge must have a reading before completing the round");
    const locationIssues = await tx.select().from(issues).where(eq(issues.locationId, location.id));
    const locationUpdates = await tx.select().from(issueUpdates).where(eq(issueUpdates.locationId, location.id));
    for (const reading of readings.filter((item: any) => item.result === "fail")) {
      const issue = locationIssues.find((item: any) => item.sourceTemperatureReadingId === reading.id && item.category === "Temperature");
      if (!issue) throw new ApiError(422, "Every failed fridge reading must have a temperature issue before completing the round");
      if (!locationUpdates.some((item: any) => item.issueId === issue.id && item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Every failed fridge must have a corrective action before completing the round");
      const existingRechecks = await tx.select({ id: rechecks.id }).from(rechecks).where(eq(rechecks.issueId, issue.id));
      if (!existingRechecks.length) throw new ApiError(422, "Every failed fridge must have a recheck before completing the round");
    }
    const completedAt = now();
    await tx.update(temperatureRounds).set({ completedAt, teamMemberId: input.teamMemberId }).where(eq(temperatureRounds.id, round.id));
    const taskRows = await tx.select().from(scheduledTasks).where(eq(scheduledTasks.locationId, location.id));
    const task = taskRows.find((item: any) => item.session === input.session);
    if (task) await tx.update(scheduledTasks).set({ status: "complete", completedAt, completedBy: context.user.id }).where(eq(scheduledTasks.id, task.id));
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "temperature_round_completed", detail: `${input.session} temperature round completed`, createdAt: completedAt });
    return { completed: true, roundId: round.id };
  });
}

export async function addIssueAction(context: AuthContext, input: { issueId: string; action: string; teamMemberId: string }) {
  requireUuid(input.issueId, "issueId");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, input.teamMemberId);
  const action = requireString(input.action, "Corrective action");
  if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed");
  return db.transaction(async (tx: any) => {
    const timestamp = now();
    await tx.update(issues).set({ action, status: "monitoring" }).where(eq(issues.id, issue.id));
    await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: action, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "corrective_action_added", detail: action, createdAt: timestamp });
    return { issueId: issue.id, status: "monitoring" };
  });
}

async function issueAndMember(context: AuthContext, issueId: string, memberId: string, category: string) {
  requireUuid(issueId, "issueId");
  const db = getDb();
  const [issue] = await db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
  if (!issue) throw new ApiError(404, "Issue not found");
  if (issue.category !== category) throw new ApiError(422, `Issue is not a ${category.toLowerCase()} issue`);
  const location = await locationFor(context, issue.locationId);
  await activeMember(location.id, memberId);
  if (issue.status === "resolved") throw new ApiError(409, `${category} issue is already resolved`);
  return { db, issue, location };
}

export async function addTemperatureRecheck(context: AuthContext, input: { issueId: string; temperature: number; teamMemberId: string }) {
  requireFiniteNumber(input.temperature, "temperature");
  const { db, issue, location } = await issueAndMember(context, input.issueId, input.teamMemberId, "Temperature");
  const updates = await db.select().from(issueUpdates).where(eq(issueUpdates.issueId, issue.id));
  if (!updates.some(item => item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Corrective action is required before recheck");
  let maximum = 8;
  if (issue.sourceTemperatureReadingId) {
    const [reading] = await db.select().from(temperatureReadings).where(eq(temperatureReadings.id, issue.sourceTemperatureReadingId)).limit(1);
    if (!reading || reading.locationId !== location.id || reading.maximumTemperature === null) throw new ApiError(422, "Source temperature reading does not contain a maximum temperature snapshot");
    maximum = reading.maximumTemperature;
  }
  return db.transaction(async (tx: any) => {
    const timestamp = now();
    const result = input.temperature <= maximum ? "pass" : "fail";
    await tx.insert(rechecks).values({ issueId: issue.id, locationId: location.id, temperature: input.temperature, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    if (result === "pass") {
      const note = `Rechecked at ${input.temperature}°C`;
      await tx.update(issues).set({ status: "resolved", resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "resolution", note, status: "resolved", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    } else {
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "further_action", note: `Recheck remained out of range at ${input.temperature}°C`, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { result, maximumTemperature: maximum };
  });
}

export async function recordFoodCheck(context: AuthContext, input: { locationId: string; product: string; quantity?: string; temperature: number; action?: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  const productName = requireString(input.product, "Product");
  const quantity = requireString(input.quantity, "Quantity");
  requireFiniteNumber(input.temperature, "temperature");
  const db = getDb();
  const productRows = await db.select().from(probeProducts).where(and(eq(probeProducts.organisationId, location.organisationId), eq(probeProducts.name, productName), eq(probeProducts.active, true)));
  const product = productRows.find(item => Array.isArray(item.locationIds) && item.locationIds.includes(location.id));
  if (!product) throw new ApiError(422, "No active probe product is configured for this location");
  return db.transaction(async (tx: any) => {
    const timestamp = now();
    const result = probeResult(input.temperature, product.minimumTemperature);
    const [check] = await tx.insert(foodChecks).values({ locationId: location.id, product: product.name, quantity, temperature: input.temperature, action: input.action?.trim() || null, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId, probeProductId: product.id, minimumTemperature: product.minimumTemperature, holdMinutes: product.holdMinutes }).returning({ id: foodChecks.id });
    let issueId: string | null = null;
    const correctiveAction = input.action?.trim();
    if (result === "fail") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Probe", title: `${product.name} probe below minimum`, description: `Recorded at ${input.temperature}°C for quantity ${quantity}. Configured minimum is ${product.minimumTemperature}°C.`, originalReading: `${input.temperature}°C`, sourceFoodCheckId: check.id, status: correctiveAction ? "monitoring" : "open", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId, action: correctiveAction || null }).returning({ id: issues.id });
      issueId = issue.id;
      if (correctiveAction) await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: correctiveAction, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { checkId: check.id, issueId, result };
  });
}

export async function addProbeRecheck(context: AuthContext, input: { issueId: string; temperature: number; teamMemberId: string }) {
  requireFiniteNumber(input.temperature, "temperature");
  const { db, issue, location } = await issueAndMember(context, input.issueId, input.teamMemberId, "Probe");
  const updates = await db.select().from(issueUpdates).where(eq(issueUpdates.issueId, issue.id));
  if (!updates.some(item => item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Corrective action is required before recheck");
  let minimum: number;
  let productName = "probe";
  if (issue.sourceFoodCheckId) {
    const [check] = await db.select().from(foodChecks).where(eq(foodChecks.id, issue.sourceFoodCheckId)).limit(1);
    if (!check || check.locationId !== location.id || check.minimumTemperature === null) throw new ApiError(422, "Original food check does not contain a temperature snapshot");
    minimum = check.minimumTemperature; productName = check.product;
  } else {
    const suffix = " probe below minimum";
    if (!issue.title.endsWith(suffix)) throw new ApiError(422, "Probe issue does not contain its original product");
    productName = issue.title.slice(0, -suffix.length).trim();
    const products = await db.select().from(probeProducts).where(and(eq(probeProducts.organisationId, location.organisationId), eq(probeProducts.name, productName), eq(probeProducts.active, true)));
    const product = products.find(item => Array.isArray(item.locationIds) && item.locationIds.includes(location.id));
    if (!product) throw new ApiError(422, "No active probe product is configured for this location");
    minimum = product.minimumTemperature;
  }
  return db.transaction(async (tx: any) => {
    const timestamp = now(); const result = probeResult(input.temperature, minimum);
    await tx.insert(rechecks).values({ issueId: issue.id, locationId: location.id, temperature: input.temperature, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    if (result === "pass") {
      const note = `Rechecked ${productName} at ${input.temperature}°C against snapshotted minimum ${minimum}°C`;
      await tx.update(issues).set({ status: "resolved", resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "resolution", note, status: "resolved", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    } else {
      await tx.update(issues).set({ status: "monitoring" }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "further_action", note: `Recheck for ${productName} remained below snapshotted minimum of ${minimum}°C at ${input.temperature}°C`, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { result };
  });
}

export async function saveChecklistResponse(context: AuthContext, input: { locationId: string; checklist: "opening" | "closing"; questionId: string; answer: "yes" | "no" | "na"; problem?: string; action?: string; teamMemberId: string }) {
  requireEnum(input.checklist, "checklist", ["opening", "closing"] as const); requireEnum(input.answer, "answer", ["yes", "no", "na"] as const);
  const location = await locationFor(context, input.locationId); requireUuid(input.questionId, "questionId");
  await activeMember(location.id, input.teamMemberId);
  if (input.answer === "no" && !input.action?.trim()) throw new ApiError(422, "A corrective action is required");
  const db = getDb();
  return db.transaction(async (tx: any) => {
    const [question] = await tx.select().from(checklistQuestions).where(and(eq(checklistQuestions.id, input.questionId), eq(checklistQuestions.locationId, location.id))).limit(1);
    if (!question) throw new ApiError(422, "Checklist question does not belong to this location");
    if (question.checklist !== input.checklist) throw new ApiError(422, "Checklist question does not match this checklist");
    if (!question.active) throw new ApiError(422, "This configuration version is no longer active");
    const range = localDayRange(Date.now(), location.timezone);
    const existing = await tx.select({ id: checklistResponses.id }).from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), eq(checklistResponses.questionId, question.id), eq(checklistResponses.checklist, input.checklist), gte(checklistResponses.createdAt, new Date(range.start)), lt(checklistResponses.createdAt, new Date(range.end))));
    if (existing.length) throw new ApiError(409, "Checklist question already answered today");
    const timestamp = now();
    const [response] = await tx.insert(checklistResponses).values({ locationId: location.id, checklist: input.checklist, questionId: question.id, answer: input.answer, problem: input.problem?.trim() || null, action: input.action?.trim() || null, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId ?? null }).returning({ id: checklistResponses.id });
    if (input.answer === "no") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Food safety", title: `${input.checklist} checklist: ${question.question}`, description: input.problem?.trim() || question.question, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId!, action: input.action!.trim() }).returning({ id: issues.id });
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "immediate_action", note: input.action!.trim(), status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId! });
    }
    return { responseId: response.id };
  });
}

export async function signOffChecklist(context: AuthContext, input: { locationId: string; checklist: "opening" | "closing"; teamMemberId: string }) {
  requireEnum(input.checklist, "checklist", ["opening", "closing"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  return db.transaction(async (tx: any) => {
    const dateKey = localDateKey(Date.now(), location.timezone);
    const existing = await tx.select().from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), eq(checklistSignOffs.checklist, input.checklist), eq(checklistSignOffs.dateKey, dateKey))).limit(1);
    if (existing[0]) return { signoffId: existing[0].id, existing: true };
    const questions = await tx.select().from(checklistQuestions).where(and(eq(checklistQuestions.locationId, location.id), eq(checklistQuestions.checklist, input.checklist), eq(checklistQuestions.active, true)));
    if (!questions.length) throw new ApiError(422, "No active checklist questions exist for this location");
    const range = localDayRange(Date.now(), location.timezone);
    const responses = await tx.select({ questionId: checklistResponses.questionId }).from(checklistResponses).where(and(eq(checklistResponses.locationId, location.id), eq(checklistResponses.checklist, input.checklist), gte(checklistResponses.createdAt, new Date(range.start)), lt(checklistResponses.createdAt, new Date(range.end))));
    const responseIds = new Set(responses.map((item: any) => item.questionId)); if (questions.some((question: any) => !responseIds.has(question.id))) throw new ApiError(422, "Every active checklist question must have a response today");
    const [signoff] = await tx.insert(checklistSignOffs).values({ locationId: location.id, checklist: input.checklist, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [checklistSignOffs.locationId, checklistSignOffs.checklist, checklistSignOffs.dateKey] }).returning({ id: checklistSignOffs.id });
    if (!signoff) {
      const [existingSignoff] = await tx.select({ id: checklistSignOffs.id }).from(checklistSignOffs).where(and(eq(checklistSignOffs.locationId, location.id), eq(checklistSignOffs.checklist, input.checklist), eq(checklistSignOffs.dateKey, dateKey))).limit(1);
      return { signoffId: existingSignoff.id, existing: true };
    }
    return { signoffId: signoff.id, existing: false };
  });
}

export async function saveSecurityResponse(context: AuthContext, input: { locationId: string; session: "AM" | "PM"; questionId: string; issue?: string; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  const [question] = await db.select().from(securityQuestions).where(and(eq(securityQuestions.id, input.questionId), eq(securityQuestions.locationId, location.id))).limit(1);
  if (!question) throw new ApiError(422, "Security question does not belong to this location"); if (question.session !== input.session) throw new ApiError(422, "Security question does not match this session"); if (!question.active) throw new ApiError(422, "This configuration version is no longer active");
  const range = localDayRange(Date.now(), location.timezone); const existing = await db.select({ id: securityResponses.id }).from(securityResponses).where(and(eq(securityResponses.locationId, location.id), eq(securityResponses.session, input.session), eq(securityResponses.questionId, question.id), gte(securityResponses.createdAt, new Date(range.start)), lt(securityResponses.createdAt, new Date(range.end)))); if (existing.length) throw new ApiError(409, "Security question already answered today");
  const [response] = await db.insert(securityResponses).values({ locationId: location.id, session: input.session, questionId: question.id, answer: "yes", issue: input.issue?.trim() || null, createdAt: now(), createdBy: context.user.id, teamMemberId: input.teamMemberId ?? null }).returning({ id: securityResponses.id }); return { responseId: response.id };
}

export async function signOffSecurity(context: AuthContext, input: { locationId: string; session: "AM" | "PM"; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const db = getDb();
  return db.transaction(async (tx: any) => {
    const dateKey = localDateKey(Date.now(), location.timezone); const existing = await tx.select().from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), eq(securitySignOffs.session, input.session), eq(securitySignOffs.dateKey, dateKey))).limit(1); if (existing[0]) return { signoffId: existing[0].id, existing: true };
    const questions = await tx.select().from(securityQuestions).where(and(eq(securityQuestions.locationId, location.id), eq(securityQuestions.session, input.session), eq(securityQuestions.active, true))); if (!questions.length) throw new ApiError(422, "No active security questions exist for this location");
    const range = localDayRange(Date.now(), location.timezone); const responses = await tx.select({ questionId: securityResponses.questionId }).from(securityResponses).where(and(eq(securityResponses.locationId, location.id), eq(securityResponses.session, input.session), gte(securityResponses.createdAt, new Date(range.start)), lt(securityResponses.createdAt, new Date(range.end)))); const ids = new Set(responses.map((item: any) => item.questionId)); if (questions.some((question: any) => !ids.has(question.id))) throw new ApiError(422, "Every active security question must have a response today");
    const [signoff] = await tx.insert(securitySignOffs).values({ locationId: location.id, session: input.session, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [securitySignOffs.locationId, securitySignOffs.session, securitySignOffs.dateKey] }).returning({ id: securitySignOffs.id });
    if (!signoff) {
      const [existingSignoff] = await tx.select({ id: securitySignOffs.id }).from(securitySignOffs).where(and(eq(securitySignOffs.locationId, location.id), eq(securitySignOffs.session, input.session), eq(securitySignOffs.dateKey, dateKey))).limit(1);
      return { signoffId: existingSignoff.id, existing: true };
    }
    return { signoffId: signoff.id, existing: false };
  });
}

export async function recordWastage(context: AuthContext, input: { locationId: string; itemId?: string; catalogueProductId?: string; adHocItemName?: string; quantity?: string; notes?: string; noWaste: boolean; teamMemberId: string }) {
  if (typeof input.noWaste !== "boolean") throw new ApiError(400, "noWaste must be boolean");
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  let mode: ReturnType<typeof parseWastageMode>;
  try {
    mode = parseWastageMode(input);
  } catch (error) {
    throw new ApiError(422, error instanceof Error ? error.message : "Invalid wastage record");
  }
  const db = getDb();
  if (mode.source === "no_waste") return insertWastage(db, { locationId: location.id, notes: input.notes, noWaste: true, source: "no_waste", userId: context.user.id, teamMemberId: input.teamMemberId });
  const quantity = requirePositiveNumberString(input.quantity);

  if (mode.source === "legacy") {
    const itemId = requireUuid(mode.itemId, "itemId");
    const [item] = await db.select().from(wastageItems).where(and(eq(wastageItems.id, itemId), eq(wastageItems.locationId, location.id))).limit(1);
    if (!item) throw new ApiError(422, "Wastage item does not belong to this location");
    if (!item.active) throw new ApiError(422, "Wastage item is inactive");
    return insertWastage(db, { locationId: location.id, itemId: item.id, itemName: item.name, quantity, notes: input.notes, noWaste: false, source: "legacy", userId: context.user.id, teamMemberId: input.teamMemberId });
  }

  if (mode.source === "adhoc") return insertWastage(db, { locationId: location.id, itemName: mode.itemName, quantity, notes: input.notes, noWaste: false, source: "adhoc", userId: context.user.id, teamMemberId: input.teamMemberId });

  const catalogueProductId = requireUuid(mode.productId, "catalogueProductId");
  return db.transaction(async tx => {
    const [product] = await tx.select().from(catalogueProducts).where(eq(catalogueProducts.id, catalogueProductId)).limit(1);
    if (!product) throw new ApiError(422, "Catalogue product does not belong to this location");
    try {
      assertCatalogueProductUsable(product, location.id);
    } catch (error) {
      throw new ApiError(422, error instanceof Error ? error.message : "Catalogue product is not available for wastage");
    }
    return insertWastage(tx, { locationId: location.id, ...catalogueWastageSnapshot(product), quantity, notes: input.notes, noWaste: false, userId: context.user.id, teamMemberId: input.teamMemberId });
  });
}

async function insertWastage(db: any, input: { locationId: string; itemId?: string; catalogueProductId?: string; itemName?: string | null; cataloguePlu?: number | null; categorySnapshot?: string | null; quantity?: string; notes?: string; noWaste: boolean; source: "no_waste" | "legacy" | "catalogue" | "adhoc"; userId: string; teamMemberId: string }) {
  const [record] = await db.insert(wastageRecords).values({ locationId: input.locationId, itemId: input.itemId ?? null, catalogueProductId: input.catalogueProductId ?? null, itemName: input.itemName ?? null, cataloguePlu: input.cataloguePlu ?? null, categorySnapshot: input.categorySnapshot ?? null, wastageSource: input.source, quantity: input.quantity ?? null, notes: input.notes?.trim() || null, noWaste: input.noWaste, createdAt: now(), createdBy: input.userId, teamMemberId: input.teamMemberId }).returning({ id: wastageRecords.id });
  return { recordId: record.id };
}

export async function completeCleaning(context: AuthContext, input: { locationId: string; taskId: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId);
  await activeMember(location.id, input.teamMemberId);
  const db = getDb();
  requireUuid(input.taskId, "taskId");
  const [task] = await db.select().from(cleaningTasks).where(and(eq(cleaningTasks.id, input.taskId), eq(cleaningTasks.locationId, location.id))).limit(1);
  if (!task) throw new ApiError(422, "Cleaning task does not belong to this location");
  if (!task.active) throw new ApiError(422, "This configuration version is no longer active");
  const dateKey = localDateKey(Date.now(), location.timezone);
  const existing = await db.select({ id: cleaningCompletions.id }).from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), eq(cleaningCompletions.taskId, task.id), eq(cleaningCompletions.dateKey, dateKey))).limit(1);
  if (existing[0]) return { completionId: existing[0].id, existing: true };
  const [completion] = await db.insert(cleaningCompletions).values({ locationId: location.id, taskId: task.id, dateKey, completedAt: now(), completedBy: context.user.id, teamMemberId: input.teamMemberId }).onConflictDoNothing({ target: [cleaningCompletions.locationId, cleaningCompletions.taskId, cleaningCompletions.dateKey] }).returning({ id: cleaningCompletions.id });
  if (!completion) {
    const [existingCompletion] = await db.select({ id: cleaningCompletions.id }).from(cleaningCompletions).where(and(eq(cleaningCompletions.locationId, location.id), eq(cleaningCompletions.taskId, task.id), eq(cleaningCompletions.dateKey, dateKey))).limit(1);
    return { completionId: existingCompletion.id, existing: true };
  }
  return { completionId: completion.id, existing: false };
}

export async function createManualIssue(context: AuthContext, input: { locationId: string; description: string; teamMemberId: string }) {
  const location = await locationFor(context, input.locationId); await activeMember(location.id, input.teamMemberId); const description = requireString(input.description, "Issue description"); const db = getDb(); const [issue] = await db.insert(issues).values({ locationId: location.id, category: "Food safety", title: "Manual issue reported", description, status: "open", createdAt: now(), createdBy: context.user.id, teamMemberId: input.teamMemberId }).returning({ id: issues.id }); return { issueId: issue.id };
}

export async function addIssueUpdate(context: AuthContext, input: { issueId: string; note: string; status: "open" | "monitoring" | "resolved"; updateType: "further_action" | "resolution" | "status_change"; teamMemberId: string }) {
  requireUuid(input.issueId, "issueId");
  requireEnum(input.status, "status", ["open", "monitoring", "resolved"] as const); requireEnum(input.updateType, "updateType", ["further_action", "resolution", "status_change"] as const);
  const db = getDb(); const [issue] = await db.select().from(issues).where(eq(issues.id, input.issueId)).limit(1); if (!issue) throw new ApiError(404, "Issue not found"); const location = await locationFor(context, issue.locationId); await activeMember(location.id, input.teamMemberId); if (issue.status === "resolved") throw new ApiError(409, "Resolved issue cannot be changed"); if (input.status === "resolved" && (issue.category === "Temperature" || issue.category === "Probe")) throw new ApiError(422, "Temperature and probe issues must be resolved by a passing recheck"); if (input.status === "resolved" && input.updateType !== "resolution") throw new ApiError(422, "Resolved issue update must be a resolution"); if (input.updateType === "resolution" && input.status !== "resolved") throw new ApiError(422, "Resolution update must resolve the issue"); const note = requireString(input.note, "Issue update"); return db.transaction(async (tx: any) => { const timestamp = now(); await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: input.updateType, note, status: input.status, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId }); await tx.update(issues).set({ status: input.status, ...(input.status === "resolved" ? { resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note } : {}) }).where(eq(issues.id, issue.id)); return { issueId: issue.id, status: input.status }; });
}
