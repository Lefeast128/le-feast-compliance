CREATE TABLE IF NOT EXISTS "shift_handover_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE RESTRICT,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "shift" text NOT NULL,
  "category" text NOT NULL,
  "version" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "shift_handover_notes_location_created_idx" ON "shift_handover_notes" ("location_id", "created_at");
CREATE TABLE IF NOT EXISTS "shift_handover_acknowledgements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL REFERENCES "shift_handover_notes"("id") ON DELETE RESTRICT,
  "note_version" integer NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "acknowledged_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_handover_ack_note_user_version_idx" ON "shift_handover_acknowledgements" ("note_id", "note_version", "user_id");
CREATE INDEX IF NOT EXISTS "shift_handover_ack_note_idx" ON "shift_handover_acknowledgements" ("note_id");
CREATE TABLE IF NOT EXISTS "shift_handover_resolutions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "note_id" uuid NOT NULL REFERENCES "shift_handover_notes"("id") ON DELETE RESTRICT,
  "note" text NOT NULL,
  "resolved_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS "shift_handover_resolution_note_idx" ON "shift_handover_resolutions" ("note_id");
