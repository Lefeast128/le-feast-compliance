CREATE TABLE "central_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"checklist" "checklist_kind" NOT NULL,
	"question" text NOT NULL,
	"location_ids" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "central_training_publications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"audience" text,
	"location_ids" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "checklist_questions" ADD COLUMN "central_item_id" uuid;--> statement-breakpoint
ALTER TABLE "training_requirements" ADD COLUMN "central_publication_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_salt" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "central_checklist_items" ADD CONSTRAINT "central_checklist_items_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "central_checklist_items" ADD CONSTRAINT "central_checklist_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "central_training_publications" ADD CONSTRAINT "central_training_publications_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "central_training_publications" ADD CONSTRAINT "central_training_publications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_central_item_id_central_checklist_items_id_fk" FOREIGN KEY ("central_item_id") REFERENCES "public"."central_checklist_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_central_publication_id_central_training_publications_id_fk" FOREIGN KEY ("central_publication_id") REFERENCES "public"."central_training_publications"("id") ON DELETE restrict ON UPDATE no action;