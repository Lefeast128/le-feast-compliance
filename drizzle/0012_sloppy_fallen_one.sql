CREATE TYPE "public"."central_allocation_mode" AS ENUM('all', 'selected');--> statement-breakpoint
CREATE TABLE "central_operational_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"checklist" "checklist_kind",
	"session" "temperature_session",
	"name" text,
	"question" text,
	"description" text,
	"frequency" text,
	"interval" integer,
	"weekdays" jsonb,
	"next_due_at" timestamp with time zone,
	"fields" jsonb,
	"location_ids" jsonb NOT NULL,
	"allocation_mode" "central_allocation_mode" DEFAULT 'selected' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "training_content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"requires_reacknowledgement" boolean
);
--> statement-breakpoint
ALTER TABLE "additional_requirements" ADD COLUMN "central_item_id" uuid;--> statement-breakpoint
ALTER TABLE "central_checklist_items" ADD COLUMN "allocation_mode" "central_allocation_mode" DEFAULT 'selected' NOT NULL;--> statement-breakpoint
ALTER TABLE "central_training_publications" ADD COLUMN "training_format" text DEFAULT 'briefing' NOT NULL;--> statement-breakpoint
ALTER TABLE "central_training_publications" ADD COLUMN "allocation_mode" "central_allocation_mode" DEFAULT 'selected' NOT NULL;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD COLUMN "central_item_id" uuid;--> statement-breakpoint
ALTER TABLE "security_questions" ADD COLUMN "central_item_id" uuid;--> statement-breakpoint
ALTER TABLE "training_completions" ADD COLUMN "content_version_id" uuid;--> statement-breakpoint
ALTER TABLE "training_requirements" ADD COLUMN "training_format" text DEFAULT 'briefing' NOT NULL;--> statement-breakpoint
ALTER TABLE "training_requirements" ADD COLUMN "current_content_version_id" uuid;--> statement-breakpoint
ALTER TABLE "training_requirements" ADD COLUMN "required_content_version_id" uuid;--> statement-breakpoint
ALTER TABLE "central_operational_items" ADD CONSTRAINT "central_operational_items_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "central_operational_items" ADD CONSTRAINT "central_operational_items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_content_versions" ADD CONSTRAINT "training_content_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "additional_requirements" ADD CONSTRAINT "additional_requirements_central_item_id_central_operational_items_id_fk" FOREIGN KEY ("central_item_id") REFERENCES "public"."central_operational_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_central_item_id_central_operational_items_id_fk" FOREIGN KEY ("central_item_id") REFERENCES "public"."central_operational_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_questions" ADD CONSTRAINT "security_questions_central_item_id_central_operational_items_id_fk" FOREIGN KEY ("central_item_id") REFERENCES "public"."central_operational_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_content_version_id_training_content_versions_id_fk" FOREIGN KEY ("content_version_id") REFERENCES "public"."training_content_versions"("id") ON DELETE restrict ON UPDATE no action;