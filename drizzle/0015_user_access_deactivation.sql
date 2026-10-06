ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "active" boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "deactivated_at" timestamptz;
