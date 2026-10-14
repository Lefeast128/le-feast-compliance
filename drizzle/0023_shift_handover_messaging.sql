ALTER TABLE "shift_handover_notes" ADD COLUMN IF NOT EXISTS "created_by_team_member_id" uuid REFERENCES "team_members"("id") ON DELETE RESTRICT;
ALTER TABLE "shift_handover_notes" ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz;
ALTER TABLE "shift_handover_notes" ADD COLUMN IF NOT EXISTS "deleted_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS "shift_handover_notes_location_active_created_idx" ON "shift_handover_notes" ("location_id", "deleted_at", "created_at");
