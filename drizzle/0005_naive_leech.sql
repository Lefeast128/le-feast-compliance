CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"storage_provider" text DEFAULT 'vercel_blob' NOT NULL,
	"pathname" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "additional_completions" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "training_document_versions" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "documents_pathname_idx" ON "documents" USING btree ("pathname");--> statement-breakpoint
CREATE INDEX "documents_location_purpose_idx" ON "documents" USING btree ("location_id","purpose","status");--> statement-breakpoint
ALTER TABLE "additional_completions" ADD CONSTRAINT "additional_completions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_document_versions" ADD CONSTRAINT "training_document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "additional_completions_document_idx" ON "additional_completions" USING btree ("document_id");