ALTER TABLE "additional_requirements"
  ADD COLUMN IF NOT EXISTS "weekdays" jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "day_of_month" integer;
--> statement-breakpoint

ALTER TABLE "central_operational_items"
  ADD COLUMN IF NOT EXISTS "day_of_month" integer;
--> statement-breakpoint

UPDATE "additional_requirements"
SET "weekdays" = jsonb_build_array(
  CASE EXTRACT(ISODOW FROM "next_due_at")::integer
    WHEN 1 THEN 1
    WHEN 2 THEN 2
    WHEN 3 THEN 3
    WHEN 4 THEN 4
    WHEN 5 THEN 5
    WHEN 6 THEN 6
    ELSE 7
  END
)
WHERE "frequency" IN ('weekly', 'every_x_weeks')
  AND "weekdays" = '[]'::jsonb;
