ALTER TABLE "central_checklist_items"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE "central_operational_items"
  ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE "checklist_questions"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE "security_questions"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

ALTER TABLE "cleaning_tasks"
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "task_type" text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS "steps" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "structured_task_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "task_area" text NOT NULL,
  "task_id" uuid NOT NULL,
  "step_id" text NOT NULL,
  "response_type" text NOT NULL,
  "response_value" text NOT NULL,
  "date_key" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "team_member_id" uuid REFERENCES "team_members"("id") ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "structured_task_responses_task_day_step_idx"
  ON "structured_task_responses" ("location_id", "task_area", "task_id", "date_key", "step_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "structured_task_responses_location_date_idx"
  ON "structured_task_responses" ("location_id", "date_key");
