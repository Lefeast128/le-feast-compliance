import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { auditEvents, equipment, issueUpdates, issues, rechecks, scheduledTasks, temperatureReadings, temperatureRounds } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { ApiError } from "./http.js";
import { activeMember, issueAndMember, locationFor, now } from "./shared.js";
import { equipmentApplicableAtRound, localDateKey, requireEnum, requireFiniteNumber, requireUuid, temperatureResult } from "./validation.js";

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
  return db.transaction(async (tx) => {
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
    const minimum = item.minimumTemperature ?? 0;
    const preferred = item.preferredTemperature ?? 5;
    const maximum = item.maximumTemperature ?? 8;
    const result = temperatureResult(input.temperature, minimum, preferred, maximum);
    const createdAt = now();
    const [reading] = await tx.insert(temperatureReadings).values({ roundId: round.id, equipmentId: item.id, locationId: location.id, temperature: input.temperature, result, createdAt, createdBy: context.user.id, teamMemberId: input.teamMemberId, voided: false, equipmentName: item.name, minimumTemperature: minimum, preferredTemperature: preferred, maximumTemperature: maximum }).onConflictDoNothing({ target: [temperatureReadings.roundId, temperatureReadings.equipmentId, temperatureReadings.voided] }).returning({ id: temperatureReadings.id });
    if (!reading) throw new ApiError(409, "This fridge already has a reading in this round");
    let issueId: string | null = null;
    if (result === "fail") {
      const [issue] = await tx.insert(issues).values({ locationId: location.id, category: "Temperature", title: `${item.name} requires action`, description: `Recorded at ${input.temperature}°C. The configured range is ${minimum}°C to ${maximum}°C.`, originalReading: `${input.temperature}°C`, sourceTemperatureReadingId: reading.id, status: "open", createdAt, createdBy: context.user.id, teamMemberId: input.teamMemberId }).returning({ id: issues.id });
      issueId = issue.id;
    }
    return { readingId: reading.id, issueId, result, minimumTemperature: minimum, preferredTemperature: preferred, maximumTemperature: maximum };
  });
}

export async function completeRound(context: AuthContext, input: { roundId: string; locationId: string; session: "AM" | "PM"; teamMemberId: string }) {
  requireEnum(input.session, "session", ["AM", "PM"] as const);
  requireUuid(input.roundId, "roundId");
  const location = await locationFor(context, input.locationId);
  await activeMember(input.locationId, input.teamMemberId);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [round] = await tx.select().from(temperatureRounds).where(and(eq(temperatureRounds.id, input.roundId), eq(temperatureRounds.locationId, location.id))).limit(1);
    if (!round) throw new ApiError(404, "Round not found");
    if (round.completedAt) return { completed: true, roundId: round.id };
    if (round.session !== input.session) throw new ApiError(422, "Round session does not match");
    const allEquipment = await tx.select().from(equipment).where(eq(equipment.locationId, location.id));
    const required = allEquipment.filter((item) => equipmentApplicableAtRound(item.createdAt, item.deactivatedAt, round.startedAt));
    const readings = await tx.select().from(temperatureReadings).where(and(eq(temperatureReadings.roundId, round.id), eq(temperatureReadings.voided, false)));
    const readingIds = new Set(readings.map((reading) => reading.equipmentId));
    if (required.some((item) => !readingIds.has(item.id))) throw new ApiError(422, "Every active fridge must have a reading before completing the round");
    const locationIssues = await tx.select().from(issues).where(eq(issues.locationId, location.id));
    const locationUpdates = await tx.select().from(issueUpdates).where(eq(issueUpdates.locationId, location.id));
    for (const reading of readings.filter((item) => item.result === "fail")) {
      const issue = locationIssues.find((item) => item.sourceTemperatureReadingId === reading.id && item.category === "Temperature");
      if (!issue) throw new ApiError(422, "Every failed fridge reading must have a temperature issue before completing the round");
      if (!locationUpdates.some((item) => item.issueId === issue.id && item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Every failed fridge must have a corrective action before completing the round");
      const existingRechecks = await tx.select({ id: rechecks.id }).from(rechecks).where(eq(rechecks.issueId, issue.id));
      if (!existingRechecks.length) throw new ApiError(422, "Every failed fridge must have a recheck before completing the round");
    }
    const completedAt = now();
    await tx.update(temperatureRounds).set({ completedAt, teamMemberId: input.teamMemberId }).where(eq(temperatureRounds.id, round.id));
    const taskRows = await tx.select().from(scheduledTasks).where(eq(scheduledTasks.locationId, location.id));
    const task = taskRows.find((item) => item.session === input.session);
    if (task) await tx.update(scheduledTasks).set({ status: "complete", completedAt, completedBy: context.user.id }).where(eq(scheduledTasks.id, task.id));
    await tx.insert(auditEvents).values({ locationId: location.id, userId: context.user.id, type: "temperature_round_completed", detail: `${input.session} temperature round completed`, createdAt: completedAt });
    return { completed: true, roundId: round.id };
  });
}

export async function addTemperatureRecheck(context: AuthContext, input: { issueId: string; temperature: number; teamMemberId: string }) {
  requireFiniteNumber(input.temperature, "temperature");
  const { db, issue, location } = await issueAndMember(context, input.issueId, input.teamMemberId, "Temperature");
  const updates = await db.select().from(issueUpdates).where(eq(issueUpdates.issueId, issue.id));
  if (!updates.some(item => item.updateType === "immediate_action" && item.note.trim())) throw new ApiError(422, "Corrective action is required before recheck");
  let minimum = 0;
  let maximum = 8;
  if (issue.sourceTemperatureReadingId) {
    const [reading] = await db.select().from(temperatureReadings).where(eq(temperatureReadings.id, issue.sourceTemperatureReadingId)).limit(1);
    if (!reading || reading.locationId !== location.id || reading.maximumTemperature === null) throw new ApiError(422, "Source temperature reading does not contain a maximum temperature snapshot");
    minimum = reading.minimumTemperature ?? 0;
    maximum = reading.maximumTemperature;
  }
  return db.transaction(async (tx) => {
    const timestamp = now();
    const result = input.temperature >= minimum && input.temperature <= maximum ? "pass" : "fail";
    await tx.insert(rechecks).values({ issueId: issue.id, locationId: location.id, temperature: input.temperature, result, createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    if (result === "pass") {
      const note = `Rechecked at ${input.temperature}°C`;
      await tx.update(issues).set({ status: "resolved", resolvedAt: timestamp, resolvedBy: context.user.id, resolutionNote: note }).where(eq(issues.id, issue.id));
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "resolution", note, status: "resolved", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    } else {
      await tx.insert(issueUpdates).values({ issueId: issue.id, locationId: location.id, updateType: "further_action", note: `Recheck remained out of range at ${input.temperature}°C`, status: "monitoring", createdAt: timestamp, createdBy: context.user.id, teamMemberId: input.teamMemberId });
    }
    return { result, minimumTemperature: minimum, maximumTemperature: maximum };
  });
}
