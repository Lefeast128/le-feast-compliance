/* eslint-disable @typescript-eslint/no-explicit-any */

export type InspectionChronologyEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  title: string;
  detail: string;
  result?: string | null;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
  sourceRecordId: string;
  relatedIssueId?: string | null;
  documentUrl?: string | null;
};

type ChronologyInput = {
  dayStart: Date;
  dayEnd: Date;
  readings?: any[];
  rounds?: any[];
  probes?: any[];
  checklistResponses?: any[];
  checklistSignoffs?: any[];
  securityResponses?: any[];
  securitySignoffs?: any[];
  cleaning?: any[];
  structuredTaskResponses?: any[];
  wastage?: any[];
  additional?: any[];
  issues?: any[];
  issueUpdates?: any[];
  rechecks?: any[];
};

const priority: Record<string, number> = {
  issue_created: 10,
  temperature_round: 20,
  temperature_reading: 30,
  food_probe: 40,
  checklist_response: 50,
  checklist_signoff: 60,
  security_response: 70,
  security_signoff: 80,
  cleaning: 90,
  structured_task_response: 95,
  wastage: 100,
  additional_check: 110,
  issue_update: 120,
  issue_recheck: 130,
  issue_resolved: 140,
};

const asDate = (value: unknown) => {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const asIso = (value: unknown) => {
  const date = asDate(value);
  return date?.toISOString() ?? null;
};

const text = (value: unknown, fallback = "") => typeof value === "string" ? value.trim() : value == null ? fallback : String(value);
const member = (row: any) => ({ teamMemberId: row?.teamMemberId ?? null, teamMemberName: row?.teamMemberName ?? null });
const answerText = (answers: unknown) => {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return "";
  return Object.entries(answers as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
};

export function buildInspectionChronology(input: ChronologyInput): InspectionChronologyEvent[] {
  const events: Array<InspectionChronologyEvent & { priority: number; ordinal: number }> = [];
  let ordinal = 0;
  const push = (event: Omit<InspectionChronologyEvent, "occurredAt"> & { occurredAt: unknown; sortPriority?: number }) => {
    const occurredAt = asDate(event.occurredAt);
    if (!occurredAt || occurredAt < input.dayStart || occurredAt > input.dayEnd) return;
    events.push({ ...event, occurredAt: occurredAt.toISOString(), priority: event.sortPriority ?? priority[event.eventType] ?? 999, ordinal: ordinal++ });
  };

  const rounds = input.rounds ?? [];
  const roundById = new Map(rounds.map(round => [round.id ?? round._id, round]));
  const issues = input.issues ?? [];
  const issueByReadingId = new Map(issues.filter(issue => issue.sourceTemperatureReadingId).map(issue => [issue.sourceTemperatureReadingId, issue]));
  const resolutionUpdateByIssue = new Map((input.issueUpdates ?? []).filter(update => update.updateType === "resolution").map(update => [update.issueId, update]));

  for (const round of rounds) {
    const completed = asDate(round.completedAt);
    push({
      id: `temperature-round:${round.id}:completion`,
      eventType: "temperature_round",
      occurredAt: completed ?? round.startedAt,
      title: `${text(round.session, "Temperature")} temperature round`,
      detail: completed ? "Round completed" : "Round started but not completed",
      result: completed ? "complete" : "incomplete",
      sourceRecordId: round.id,
      ...member(round),
    });
  }

  for (const reading of input.readings ?? []) {
    const round = roundById.get(reading.roundId);
    const session = text(round?.session, "Temperature");
    const equipmentName = text(reading.equipmentName, "Equipment");
    push({
      id: `temperature-reading:${reading.id}`,
      eventType: "temperature_reading",
      occurredAt: reading.createdAt,
      title: `${session} temperature`,
      detail: `${equipmentName} · ${reading.temperature}°C`,
      result: reading.result === "fail" ? "fail" : "pass",
      sourceRecordId: reading.id,
      relatedIssueId: issueByReadingId.get(reading.id)?.id ?? null,
      ...member(reading.teamMemberId ? reading : round ?? reading),
    });
  }

  for (const probe of input.probes ?? []) {
    const limits = probe.minimumTemperature == null ? "" : ` · minimum ${probe.minimumTemperature}°C`;
    const hold = probe.holdMinutes == null ? "" : ` · hold ${probe.holdMinutes} min`;
    push({
      id: `food-probe:${probe.id}`,
      eventType: "food_probe",
      occurredAt: probe.createdAt,
      title: "Food probe",
      detail: `${text(probe.product, "Product")} · ${probe.temperature}°C${probe.quantity ? ` · ${probe.quantity}` : ""}${limits}${hold}${probe.action ? ` · ${probe.action}` : ""}`,
      result: probe.result,
      sourceRecordId: probe.id,
      ...member(probe),
    });
  }

  for (const response of input.checklistResponses ?? []) {
    const answer = text(response.answer, "Not recorded");
    const detail = [text(response.question, "Checklist question"), answer, response.problem ? `Problem: ${response.problem}` : "", response.action ? `Action: ${response.action}` : ""].filter(Boolean).join(" · ");
    push({
      id: `checklist-response:${response.id}`,
      eventType: "checklist_response",
      occurredAt: response.createdAt,
      title: `${text(response.checklist, "Checklist")} checklist`,
      detail,
      result: answer,
      sourceRecordId: response.id,
      ...member(response),
    });
  }

  for (const signoff of input.checklistSignoffs ?? []) {
    push({
      id: `checklist-signoff:${signoff.id}`,
      eventType: "checklist_signoff",
      occurredAt: signoff.completedAt,
      title: `${text(signoff.checklist, "Checklist")} checklist sign-off`,
      detail: "Checklist signed off",
      result: "complete",
      sourceRecordId: signoff.id,
      ...member(signoff),
    });
  }

  for (const response of input.securityResponses ?? []) {
    const detail = [text(response.question, "Security question"), text(response.answer, "Not recorded"), response.issue ? `Issue: ${response.issue}` : ""].filter(Boolean).join(" · ");
    push({
      id: `security-response:${response.id}`,
      eventType: "security_response",
      occurredAt: response.createdAt,
      title: `${text(response.session, "Security")} security check`,
      detail,
      result: response.answer,
      sourceRecordId: response.id,
      ...member(response),
    });
  }

  for (const signoff of input.securitySignoffs ?? []) {
    push({
      id: `security-signoff:${signoff.id}`,
      eventType: "security_signoff",
      occurredAt: signoff.completedAt,
      title: `${text(signoff.session, "Security")} security sign-off`,
      detail: "Security session signed off",
      result: "complete",
      sourceRecordId: signoff.id,
      ...member(signoff),
    });
  }

  for (const completion of input.cleaning ?? []) {
    push({
      id: `cleaning:${completion.id}`,
      eventType: "cleaning",
      occurredAt: completion.completedAt,
      title: "Cleaning completed",
      detail: text(completion.taskName, "Cleaning task"),
      result: "complete",
      sourceRecordId: completion.id,
      ...member(completion),
    });
  }

  for (const response of input.structuredTaskResponses ?? []) {
    const answer = text(response.responseValue, "Not recorded");
    push({
      id: `structured-task-response:${response.id}`,
      eventType: "structured_task_response",
      occurredAt: response.createdAt,
      title: `${text(response.taskArea, "Operational task")} task`,
      detail: [text(response.taskTitle, "Task"), text(response.stepLabel, "Step"), answer].filter(Boolean).join(" · "),
      result: answer,
      sourceRecordId: response.id,
      ...member(response),
    });
  }

  for (const record of input.wastage ?? []) {
    const item = record.noWaste ? "No Waste" : text(record.itemName, "Wastage item");
    const detail = [item, record.quantity ? `Quantity: ${record.quantity}` : "", record.notes ? `Notes: ${record.notes}` : "", record.cataloguePlu ? `PLU ${record.cataloguePlu}` : "", record.categorySnapshot ? `Category: ${record.categorySnapshot}` : ""].filter(Boolean).join(" · ");
    push({
      id: `wastage:${record.id}`,
      eventType: "wastage",
      occurredAt: record.createdAt,
      title: record.noWaste ? "No Waste recorded" : "Wastage recorded",
      detail,
      result: record.noWaste ? "no_waste" : "recorded",
      sourceRecordId: record.id,
      ...member(record),
    });
  }

  for (const completion of input.additional ?? []) {
    const answers = answerText(completion.answers);
    push({
      id: `additional-check:${completion.id}`,
      eventType: "additional_check",
      occurredAt: completion.completedAt,
      title: text(completion.requirementTitle, "Additional check"),
      detail: [answers, completion.certificateReference ? `Certificate: ${completion.certificateReference}` : ""].filter(Boolean).join(" · ") || "Completed",
      result: "complete",
      sourceRecordId: completion.id,
      documentUrl: completion.documentUrl ?? null,
      ...member(completion),
    });
  }

  for (const issue of issues) {
    push({
      id: `issue-created:${issue.id}`,
      eventType: "issue_created",
      occurredAt: issue.createdAt,
      title: "Issue created",
      detail: [text(issue.title, "Issue"), text(issue.description), issue.originalReading ? `Reading: ${issue.originalReading}` : "", issue.action ? `Action: ${issue.action}` : ""].filter(Boolean).join(" · "),
      result: issue.status,
      sourceRecordId: issue.id,
      relatedIssueId: issue.id,
      ...member(issue),
    });
    push({
      id: `issue-resolved:${issue.id}`,
      eventType: "issue_resolved",
      occurredAt: issue.resolvedAt,
      title: "Issue resolved",
      detail: text(issue.resolutionNote, "Issue marked resolved"),
      result: "resolved",
      sourceRecordId: issue.id,
      relatedIssueId: issue.id,
      ...member(resolutionUpdateByIssue.get(issue.id) ?? {}),
    });
  }

  for (const update of input.issueUpdates ?? []) {
    push({
      id: `issue-update:${update.id}`,
      eventType: "issue_update",
      occurredAt: update.createdAt,
      title: update.updateType === "immediate_action" || update.updateType === "action" ? "Corrective action" : update.updateType === "further_action" ? "Further action" : update.updateType === "manager_review" ? "Manager review" : update.updateType === "resolution" ? "Resolution" : "Issue update",
      detail: text(update.note, "Update recorded"),
      result: update.status,
      sourceRecordId: update.id,
      relatedIssueId: update.issueId,
      sortPriority: update.updateType === "resolution" ? 135 : undefined,
      ...member(update),
    });
  }

  for (const recheck of input.rechecks ?? []) {
    push({
      id: `issue-recheck:${recheck.id}`,
      eventType: "issue_recheck",
      occurredAt: recheck.createdAt,
      title: "Recheck",
      detail: `Temperature ${recheck.temperature}°C`,
      result: recheck.result,
      sourceRecordId: recheck.id,
      relatedIssueId: recheck.issueId,
      ...member(recheck),
    });
  }

  return events
    .sort((a, b) => {
      const time = a.occurredAt.localeCompare(b.occurredAt);
      if (time !== 0) return time;
      const kind = a.priority - b.priority;
      if (kind !== 0) return kind;
      const source = a.sourceRecordId.localeCompare(b.sourceRecordId);
      return source !== 0 ? source : a.ordinal - b.ordinal;
    })
    .map(event => {
      const result = { ...event } as Partial<InspectionChronologyEvent> & { priority?: number; ordinal?: number };
      delete (result as { sortPriority?: number }).sortPriority;
      delete result.priority;
      delete result.ordinal;
      return result as InspectionChronologyEvent;
    });
}

export function carriedOpenIssues(issues: any[], dayStart: Date) {
  return issues
    .filter(issue => {
      const createdAt = asDate(issue.createdAt);
      const resolvedAt = asDate(issue.resolvedAt);
      return Boolean(createdAt && createdAt < dayStart && issue.status !== "resolved" && (!resolvedAt || resolvedAt > dayStart));
    })
    .map(issue => ({
      id: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      createdAt: asIso(issue.createdAt),
      resolvedAt: asIso(issue.resolvedAt),
      originalReading: issue.originalReading ?? null,
      action: issue.action ?? null,
      teamMemberId: issue.teamMemberId ?? null,
      teamMemberName: issue.teamMemberName ?? null,
    }));
}
