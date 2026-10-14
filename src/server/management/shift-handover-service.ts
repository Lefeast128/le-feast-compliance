import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { shiftHandoverAcknowledgements, shiftHandoverNotes, shiftHandoverResolutions, users } from "../db/schema.js";
import type { AuthContext } from "../auth/core.js";
import { requireLocationManager } from "../auth/core.js";
import { ApiError } from "../compliance/http.js";
import { idempotentOfflineMutation } from "../compliance/offline-idempotency.js";
import { locationFor, now } from "../compliance/shared.js";
import { requireEnum, requireString, requireUuid } from "../compliance/validation.js";

const categories = ["information", "action_required", "urgent"] as const;

async function noteFor(context: AuthContext, noteId: string) {
  requireUuid(noteId, "noteId");
  const db = getDb();
  const [note] = await db.select().from(shiftHandoverNotes).where(eq(shiftHandoverNotes.id, noteId)).limit(1);
  if (!note) throw new ApiError(404, "Handover note not found");
  const location = await locationFor(context, note.locationId);
  return { db, note, location };
}

export async function listHandover(context: AuthContext, locationId: string) {
  const location = await locationFor(context, locationId);
  const db = getDb();
  const noteRows = await db.select({ note: shiftHandoverNotes, authorName: users.name, authorEmail: users.email })
    .from(shiftHandoverNotes)
    .leftJoin(users, eq(users.id, shiftHandoverNotes.createdBy))
    .where(eq(shiftHandoverNotes.locationId, location.id))
    .orderBy(asc(shiftHandoverNotes.createdAt));
  const noteIds = noteRows.map(row => row.note.id);
  if (!noteIds.length) return { notes: [], unreadCount: 0 };
  const acknowledgements = await db.select().from(shiftHandoverAcknowledgements).where(and(eq(shiftHandoverAcknowledgements.userId, context.user.id), inArray(shiftHandoverAcknowledgements.noteId, noteIds)));
  const allAckRows = await db.select().from(shiftHandoverAcknowledgements).where(inArray(shiftHandoverAcknowledgements.noteId, noteIds));
  const allResolutionRows = await db.select().from(shiftHandoverResolutions).where(inArray(shiftHandoverResolutions.noteId, noteIds));
  const notes = noteRows.map(({ note, authorName, authorEmail }) => {
    const mine = acknowledgements.find(row => row.noteId === note.id && row.noteVersion === note.version);
    const ackCount = allAckRows.filter(row => row.noteId === note.id && row.noteVersion === note.version).length;
    const resolution = allResolutionRows.find(row => row.noteId === note.id);
    return {
      id: note.id, locationId: note.locationId, title: note.title, message: note.message, shift: note.shift, category: note.category,
      version: note.version, createdAt: note.createdAt, author: { id: note.createdBy, name: authorName, email: authorEmail },
      acknowledgedByMe: Boolean(mine), acknowledgedAt: mine?.acknowledgedAt ?? null, acknowledgementCount: ackCount,
      resolved: Boolean(resolution), resolvedAt: resolution?.resolvedAt ?? null, resolvedBy: resolution?.resolvedBy ?? null, resolutionNote: resolution?.note ?? null,
    };
  });
  return { notes, unreadCount: notes.filter(note => !note.acknowledgedByMe).length };
}

export async function createHandover(context: AuthContext, input: { locationId: string; title?: string; message: string; shift?: string; category?: string; idempotencyKey?: string }) {
  const location = await locationFor(context, input.locationId);
  const title = input.title?.trim() || "Message";
  const message = requireString(input.message, "Message");
  const shift = input.shift?.trim() || "Current shift";
  const category = input.category ? requireEnum(input.category, "Category", categories) : "information";
  const db = getDb();
  return db.transaction(tx => idempotentOfflineMutation(tx, context, { key: input.idempotencyKey, organisationId: location.organisationId, locationId: location.id, operation: "handover-note", payload: input }, async () => {
    const [note] = await tx.insert(shiftHandoverNotes).values({ organisationId: location.organisationId, locationId: location.id, title, message, shift, category, version: 1, createdAt: now(), createdBy: context.user.id }).returning({ id: shiftHandoverNotes.id });
    return { noteId: note.id, version: 1, serverConfirmed: true };
  }));
}

export async function acknowledgeHandover(context: AuthContext, noteId: string) {
  const { db, note, location } = await noteFor(context, noteId);
  await db.insert(shiftHandoverAcknowledgements).values({ noteId: note.id, noteVersion: note.version, userId: context.user.id }).onConflictDoNothing({ target: [shiftHandoverAcknowledgements.noteId, shiftHandoverAcknowledgements.noteVersion, shiftHandoverAcknowledgements.userId] });
  return { noteId: note.id, locationId: location.id, acknowledged: true };
}

export async function resolveHandover(context: AuthContext, input: { noteId: string; resolutionNote: string }) {
  const { db, note, location } = await noteFor(context, input.noteId);
  requireLocationManager(context, location.id, location.organisationId);
  const resolutionNote = requireString(input.resolutionNote, "Resolution note");
  const [resolution] = await db.insert(shiftHandoverResolutions).values({ noteId: note.id, note: resolutionNote, resolvedAt: now(), resolvedBy: context.user.id }).onConflictDoNothing({ target: shiftHandoverResolutions.noteId }).returning({ id: shiftHandoverResolutions.id });
  return { noteId: note.id, resolved: true, alreadyResolved: !resolution };
}
