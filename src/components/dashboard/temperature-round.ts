import type { Equipment } from "./dashboard-types";

type TemperatureSession = "AM" | "PM";

type StartRound = (input: { locationId: string; session: TemperatureSession }) => Promise<string>;
type RecordTemperature = (input: {
  roundId: string;
  locationId: string;
  equipmentId: string;
  temperature: number;
  teamMemberId: string;
}) => Promise<{ issueId?: string | null }>;
type CompleteRound = (input: {
  roundId: string;
  locationId: string;
  session: TemperatureSession;
  teamMemberId: string;
}) => Promise<unknown>;

export type TemperatureRoundIssue = Equipment & { issueId: string; temperature: number };

type SubmitTemperatureRoundArgs = {
  roundId: string | null;
  locationId: string;
  session: TemperatureSession;
  teamMemberId: string;
  equipment: Equipment[];
  temperatures: Record<string, string>;
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
  startRound,
  recordTemperature,
  completeRound,
}: SubmitTemperatureRoundArgs) {
  const submittedRoundId = roundId ?? await startRound({ locationId, session });
  const issues: TemperatureRoundIssue[] = [];

  for (const item of equipment) {
    const temperature = Number(temperatures[item._id]);
    const result = await recordTemperature({
      roundId: submittedRoundId,
      locationId,
      equipmentId: item._id,
      temperature,
      teamMemberId,
    });
    if (result.issueId) issues.push({ ...item, issueId: result.issueId, temperature });
  }

  if (!issues.length) await completeRound({ roundId: submittedRoundId, locationId, session, teamMemberId });
  return { roundId: submittedRoundId, issues };
}
