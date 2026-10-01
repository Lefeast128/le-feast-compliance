CREATE TYPE "public"."checklist_kind" AS ENUM('opening', 'closing');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('staff', 'manager');--> statement-breakpoint
CREATE TYPE "public"."temperature_result" AS ENUM('normal', 'within_limit', 'fail');--> statement-breakpoint
CREATE TYPE "public"."temperature_session" AS ENUM('AM', 'PM');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "additional_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"checked_date" text,
	"next_due_at" timestamp with time zone,
	"scheduled_due_at" timestamp with time zone,
	"answers" jsonb NOT NULL,
	"certificate_reference" text,
	"document_storage_id" text,
	"document_name" text,
	"team_member_id" uuid NOT NULL,
	"completed_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "additional_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"frequency" text NOT NULL,
	"interval" integer,
	"next_due_at" timestamp with time zone NOT NULL,
	"fields" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"version_root_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"detail" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogue_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"site_id" text NOT NULL,
	"plu" integer NOT NULL,
	"name" text NOT NULL,
	"department" text,
	"product_group" text,
	"value_sources" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"needs_category_review" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_successful_sync_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogue_sync_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"last_successful_sync_at" timestamp with time zone,
	"last_attempted_sync_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"product_count" integer,
	"added_count" integer,
	"renamed_count" integer,
	"removed_count" integer
);
--> statement-breakpoint
CREATE TABLE "checklist_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"checklist" "checklist_kind" NOT NULL,
	"question" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"version_root_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"checklist" "checklist_kind" NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"problem" text,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "checklist_sign_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"checklist" "checklist_kind" NOT NULL,
	"date_key" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" uuid NOT NULL,
	"team_member_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cleaning_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"date_key" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cleaning_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"frequency" text NOT NULL,
	"weekdays" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"version_root_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"preferred_temperature" integer,
	"maximum_temperature" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"product" text NOT NULL,
	"quantity" text,
	"temperature" integer NOT NULL,
	"result" text NOT NULL,
	"action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid,
	"probe_product_id" uuid,
	"minimum_temperature" integer,
	"hold_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "issue_updates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"update_type" text NOT NULL,
	"note" text NOT NULL,
	"status" "issue_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "issue_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid,
	"action" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution_note" text,
	"original_reading" text,
	"source_temperature_reading_id" uuid,
	"source_food_check_id" uuid,
	"source_additional_completion_id" uuid
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"role" "membership_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "probe_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"name" text NOT NULL,
	"minimum_temperature" integer NOT NULL,
	"hold_minutes" integer NOT NULL,
	"location_ids" jsonb NOT NULL,
	"sort_order" integer,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"version_root_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rechecks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"reading_id" uuid,
	"temperature" integer NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"session" text,
	"due_label" text NOT NULL,
	"status" text NOT NULL,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"session" "temperature_session" NOT NULL,
	"question" text NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"version_root_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"session" "temperature_session" NOT NULL,
	"question_id" uuid NOT NULL,
	"answer" text NOT NULL,
	"issue" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE TABLE "security_sign_offs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"session" "temperature_session" NOT NULL,
	"date_key" text NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" uuid NOT NULL,
	"team_member_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'team' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "temperature_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"equipment_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"temperature" integer NOT NULL,
	"result" "temperature_result" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid,
	"voided" boolean DEFAULT false NOT NULL,
	"equipment_name" text,
	"preferred_temperature" integer,
	"maximum_temperature" integer
);
--> statement-breakpoint
CREATE TABLE "temperature_rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"session" "temperature_session" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"requirement_id" uuid NOT NULL,
	"team_member_id" uuid NOT NULL,
	"document_version_id" uuid,
	"completed_at" timestamp with time zone NOT NULL,
	"completed_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requirement_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"storage_id" text NOT NULL,
	"document_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"requires_reacknowledgement" boolean
);
--> statement-breakpoint
CREATE TABLE "training_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"title" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"document_storage_id" text,
	"document_name" text,
	"current_document_version_id" uuid,
	"required_document_version_id" uuid,
	"description" text,
	"category" text,
	"audience" text,
	"selected_team_member_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"is_anonymous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wastage_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wastage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"item_id" uuid,
	"item_name" text,
	"quantity" text,
	"notes" text,
	"no_waste" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"team_member_id" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_products_location_plu_idx" ON "catalogue_products" USING btree ("location_id","plu");--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_sync_status_location_idx" ON "catalogue_sync_status" USING btree ("location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "checklist_sign_offs_day_idx" ON "checklist_sign_offs" USING btree ("location_id","checklist","date_key");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_location_idx" ON "memberships" USING btree ("user_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "security_sign_offs_day_idx" ON "security_sign_offs" USING btree ("location_id","session","date_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "organisations_name_idx" ON "organisations" USING btree ("name");
--> statement-breakpoint
CREATE UNIQUE INDEX "locations_org_short_name_idx" ON "locations" USING btree ("organisation_id","short_name");
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organisation_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_organisation_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "temperature_rounds" ADD CONSTRAINT "temperature_rounds_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "temperature_rounds" ADD CONSTRAINT "temperature_rounds_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "temperature_rounds" ADD CONSTRAINT "temperature_rounds_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD CONSTRAINT "temperature_readings_round_fk" FOREIGN KEY ("round_id") REFERENCES "temperature_rounds"("id");
--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD CONSTRAINT "temperature_readings_equipment_fk" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id");
--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD CONSTRAINT "temperature_readings_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD CONSTRAINT "temperature_readings_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD CONSTRAINT "temperature_readings_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "probe_products" ADD CONSTRAINT "probe_products_organisation_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id");
--> statement-breakpoint
ALTER TABLE "probe_products" ADD CONSTRAINT "probe_products_root_fk" FOREIGN KEY ("version_root_id") REFERENCES "probe_products"("id");
--> statement-breakpoint
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_root_fk" FOREIGN KEY ("version_root_id") REFERENCES "checklist_questions"("id");
--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_question_fk" FOREIGN KEY ("question_id") REFERENCES "checklist_questions"("id");
--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "checklist_responses" ADD CONSTRAINT "checklist_responses_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "checklist_sign_offs" ADD CONSTRAINT "checklist_sign_offs_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "checklist_sign_offs" ADD CONSTRAINT "checklist_sign_offs_user_fk" FOREIGN KEY ("completed_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "checklist_sign_offs" ADD CONSTRAINT "checklist_sign_offs_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "security_questions" ADD CONSTRAINT "security_questions_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "security_questions" ADD CONSTRAINT "security_questions_root_fk" FOREIGN KEY ("version_root_id") REFERENCES "security_questions"("id");
--> statement-breakpoint
ALTER TABLE "security_responses" ADD CONSTRAINT "security_responses_question_fk" FOREIGN KEY ("question_id") REFERENCES "security_questions"("id");
--> statement-breakpoint
ALTER TABLE "security_responses" ADD CONSTRAINT "security_responses_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "security_responses" ADD CONSTRAINT "security_responses_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "security_responses" ADD CONSTRAINT "security_responses_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "security_sign_offs" ADD CONSTRAINT "security_sign_offs_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "security_sign_offs" ADD CONSTRAINT "security_sign_offs_user_fk" FOREIGN KEY ("completed_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "security_sign_offs" ADD CONSTRAINT "security_sign_offs_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "food_checks" ADD CONSTRAINT "food_checks_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "food_checks" ADD CONSTRAINT "food_checks_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "food_checks" ADD CONSTRAINT "food_checks_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "food_checks" ADD CONSTRAINT "food_checks_probe_product_fk" FOREIGN KEY ("probe_product_id") REFERENCES "probe_products"("id");
--> statement-breakpoint
ALTER TABLE "wastage_items" ADD CONSTRAINT "wastage_items_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_item_fk" FOREIGN KEY ("item_id") REFERENCES "wastage_items"("id");
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "catalogue_products" ADD CONSTRAINT "catalogue_products_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "catalogue_sync_status" ADD CONSTRAINT "catalogue_sync_status_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "cleaning_tasks" ADD CONSTRAINT "cleaning_tasks_root_fk" FOREIGN KEY ("version_root_id") REFERENCES "cleaning_tasks"("id");
--> statement-breakpoint
ALTER TABLE "cleaning_completions" ADD CONSTRAINT "cleaning_completions_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "cleaning_completions" ADD CONSTRAINT "cleaning_completions_task_fk" FOREIGN KEY ("task_id") REFERENCES "cleaning_tasks"("id");
--> statement-breakpoint
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_current_version_fk" FOREIGN KEY ("current_document_version_id") REFERENCES "training_document_versions"("id");
--> statement-breakpoint
ALTER TABLE "training_requirements" ADD CONSTRAINT "training_requirements_required_version_fk" FOREIGN KEY ("required_document_version_id") REFERENCES "training_document_versions"("id");
--> statement-breakpoint
ALTER TABLE "training_document_versions" ADD CONSTRAINT "training_document_versions_requirement_fk" FOREIGN KEY ("requirement_id") REFERENCES "training_requirements"("id");
--> statement-breakpoint
ALTER TABLE "training_document_versions" ADD CONSTRAINT "training_document_versions_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_requirement_fk" FOREIGN KEY ("requirement_id") REFERENCES "training_requirements"("id");
--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_version_fk" FOREIGN KEY ("document_version_id") REFERENCES "training_document_versions"("id");
--> statement-breakpoint
ALTER TABLE "training_completions" ADD CONSTRAINT "training_completions_user_fk" FOREIGN KEY ("completed_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "additional_requirements" ADD CONSTRAINT "additional_requirements_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "additional_requirements" ADD CONSTRAINT "additional_requirements_root_fk" FOREIGN KEY ("version_root_id") REFERENCES "additional_requirements"("id");
--> statement-breakpoint
ALTER TABLE "additional_completions" ADD CONSTRAINT "additional_completions_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "additional_completions" ADD CONSTRAINT "additional_completions_requirement_fk" FOREIGN KEY ("requirement_id") REFERENCES "additional_requirements"("id");
--> statement-breakpoint
ALTER TABLE "additional_completions" ADD CONSTRAINT "additional_completions_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "additional_completions" ADD CONSTRAINT "additional_completions_user_fk" FOREIGN KEY ("completed_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_source_temperature_fk" FOREIGN KEY ("source_temperature_reading_id") REFERENCES "temperature_readings"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_source_food_fk" FOREIGN KEY ("source_food_check_id") REFERENCES "food_checks"("id");
--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_source_additional_fk" FOREIGN KEY ("source_additional_completion_id") REFERENCES "additional_completions"("id");
--> statement-breakpoint
ALTER TABLE "rechecks" ADD CONSTRAINT "rechecks_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "rechecks" ADD CONSTRAINT "rechecks_issue_fk" FOREIGN KEY ("issue_id") REFERENCES "issues"("id");
--> statement-breakpoint
ALTER TABLE "rechecks" ADD CONSTRAINT "rechecks_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "rechecks" ADD CONSTRAINT "rechecks_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_issue_fk" FOREIGN KEY ("issue_id") REFERENCES "issues"("id");
--> statement-breakpoint
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_user_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id");
--> statement-breakpoint
ALTER TABLE "issue_updates" ADD CONSTRAINT "issue_updates_team_member_fk" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id");
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_location_fk" FOREIGN KEY ("location_id") REFERENCES "locations"("id");
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");
