CREATE TABLE IF NOT EXISTS "offline_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" text NOT NULL,
  "organisation_id" uuid NOT NULL,
  "location_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "operation" text NOT NULL,
  "status" text NOT NULL DEFAULT 'processing',
  "response" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "completed_at" timestamptz
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "offline_submissions_submission_id_idx" ON "offline_submissions" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "offline_submissions_scope_idx" ON "offline_submissions" USING btree ("organisation_id", "location_id", "user_id");
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offline_submissions" ADD CONSTRAINT "offline_submissions_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offline_submissions" ADD CONSTRAINT "offline_submissions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "offline_submissions" ADD CONSTRAINT "offline_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
