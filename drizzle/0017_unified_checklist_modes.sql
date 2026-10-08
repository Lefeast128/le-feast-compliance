ALTER TABLE "central_checklist_items" ADD COLUMN IF NOT EXISTS "completion_mode" text NOT NULL DEFAULT 'question';
ALTER TABLE "central_operational_items" ADD COLUMN IF NOT EXISTS "completion_mode" text NOT NULL DEFAULT 'question';
ALTER TABLE "checklist_questions" ADD COLUMN IF NOT EXISTS "completion_mode" text NOT NULL DEFAULT 'question';
ALTER TABLE "security_questions" ADD COLUMN IF NOT EXISTS "completion_mode" text NOT NULL DEFAULT 'question';
ALTER TABLE "cleaning_tasks" ADD COLUMN IF NOT EXISTS "completion_mode" text NOT NULL DEFAULT 'question';
