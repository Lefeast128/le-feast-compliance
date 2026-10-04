CREATE TABLE "manager_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"review_type" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" uuid NOT NULL,
	"summary" jsonb NOT NULL,
	"serious_problems" boolean,
	"details" text,
	"action_taken" text,
	"answers" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manager_reviews" ADD CONSTRAINT "manager_reviews_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_reviews" ADD CONSTRAINT "manager_reviews_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "manager_reviews_period_idx" ON "manager_reviews" USING btree ("location_id","review_type","period_start");