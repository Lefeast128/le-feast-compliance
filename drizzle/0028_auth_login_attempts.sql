-- Only the new table: several earlier migrations were hand-written without snapshots,
-- so drizzle-kit re-emitted their changes here. The 0028 snapshot now matches the real schema.
CREATE TABLE IF NOT EXISTS "auth_login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"failures" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone
);
