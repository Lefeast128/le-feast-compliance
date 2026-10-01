ALTER TABLE "users" ADD COLUMN "normalized_email" text;
--> statement-breakpoint
UPDATE "users" SET "normalized_email" = lower(btrim("email")) WHERE "normalized_email" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "normalized_email" SET NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "users_normalized_email_idx" ON "users" USING btree ("normalized_email");
--> statement-breakpoint
CREATE TABLE "auth_otp_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "normalized_email" text NOT NULL,
  "otp_digest" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "invalidated_at" timestamp with time zone,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 5 NOT NULL,
  "rate_limit_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_otp_challenges_email_created_idx" ON "auth_otp_challenges" USING btree ("normalized_email", "created_at");
--> statement-breakpoint
CREATE INDEX "auth_otp_challenges_rate_created_idx" ON "auth_otp_challenges" USING btree ("rate_limit_key", "created_at");
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "last_used_at" timestamp with time zone,
  "rotated_from_id" uuid
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_hash_idx" ON "auth_sessions" USING btree ("token_hash");
--> statement-breakpoint
CREATE INDEX "auth_sessions_user_created_idx" ON "auth_sessions" USING btree ("user_id", "created_at");
