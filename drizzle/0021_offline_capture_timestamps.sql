ALTER TABLE "temperature_readings" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
ALTER TABLE "food_checks" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
ALTER TABLE "rechecks" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
ALTER TABLE "issue_updates" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
ALTER TABLE "wastage_records" ADD COLUMN IF NOT EXISTS "captured_at" timestamptz;
