import type { Equipment } from "./dashboard-types";

type TemperatureSession = "AM" | "PM";

type StartRound = (input: { locationId: string; session: TemperatureSession }) => Promise<string>;
type RecordTemperature = (input: {
  roundId: string;
  locationId: string;
  equipmentId: string;
  temperature: number;
  teamMemberId: string;
}) => Promise<{ readingId?: string; issueId?: string | null; result?: string }>;
type CompleteRound = (input: {
  roundId: string;
  locationId: string;
  session: TemperatureSession;
  teamMemberId: string;
}) => Promise<unknown>;

export type TemperatureRoundIssue = Equipment & { issueId: string; temperature: number };
export type SubmittedTemperatureReading = { equipmentId: string; issueId?: string | null; result?: string; temperature: number };

type SubmitTemperatureRoundArgs = {
  roundId: string | null;
  locationId: string;
  session: TemperatureSession;
  teamMemberId: string;
  equipment: Equipment[];
  temperatures: Record<string, string>;
  existingReadings?: Array<{ equipmentId?: string; result?: string; issueId?: string | null }>;
  startRound: StartRound;
  recordTemperature: RecordTemperature;
  completeRound: CompleteRound;
};

export async function submitTemperatureRound({
  roundId,
  locationId,
  session,
  teamMemberId,
  equipment,
  temperatures,
  existingReadings = [],
  startRound,
  recordTemperature,
  completeRound,
}: SubmitTemperatureRoundArgs) {
  const submittedRoundId = roundId ?? await startRound({ locationId, session });
  const issues: TemperatureRoundIssue[] = [];
  const savedReadings: SubmittedTemperatureReading[] = [];
  const recordedEquipment = new Set(existingReadings.map((reading) => reading.equipmentId).filter(Boolean));

  for (const item of equipment) {
    if (recordedEquipment.has(item._id)) continue;
    const temperature = Number(temperatures[item._id]);
    try {
      const result = await recordTemperature({
        roundId: submittedRoundId,
        locationId,
        equipmentId: item._id,
        temperature,
        teamMemberId,
      });
      recordedEquipment.add(item._id);
      savedReadings.push({ equipmentId: item._id, issueId: result.issueId, result: result.result, temperature });
      if (result.issueId) issues.push({ ...item, issueId: result.issueId, temperature });
    } catch (error) {
      // A retry may race with another device, or may follow a request that
      // reached the server before the client lost its connection. The API's
      // unique round/equipment constraint makes a 409 safe to reconcile by
      // skipping this item; other failures must remain visible to the caller.
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const status = typeof error === "object" && error !== null && "status" in error ? Number((error as { status?: unknown }).status) : 0;
      if (status === 409 || message.includes("already has a reading") || message.includes("already complete")) {
        recordedEquipment.add(item._id);
        continue;
      }
      return { roundId: submittedRoundId, issues, savedReadings, error: error instanceof Error ? error : new Error("Temperature readings could not be saved") };
    }
  }

  if (!issues.length) await completeRound({ roundId: submittedRoundId, locationId, session, teamMemberId });
  return { roundId: submittedRoundId, issues, savedReadings };
}
