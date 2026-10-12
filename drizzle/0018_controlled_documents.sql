CREATE TABLE IF NOT EXISTS "controlled_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "location_ids" jsonb NOT NULL,
  "allocation_mode" "central_allocation_mode" NOT NULL DEFAULT 'selected',
  "display_in_library" boolean NOT NULL DEFAULT true,
  "require_training_acknowledgement" boolean NOT NULL DEFAULT false,
  "acknowledgement_deadline" timestamptz,
  "publication_date" timestamptz,
  "review_date" timestamptz,
  "active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controlled_documents_organisation_active_idx" ON "controlled_documents" USING btree ("organisation_id", "active");
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "controlled_documents" ADD CONSTRAINT "controlled_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "controlled_document_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "controlled_document_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "published_at" timestamptz,
  "review_date" timestamptz,
  "requires_reacknowledgement" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "controlled_document_versions_document_version_idx" ON "controlled_document_versions" USING btree ("controlled_document_id", "version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "controlled_document_versions_document_idx" ON "controlled_document_versions" USING btree ("document_id");
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "controlled_document_versions" ADD CONSTRAINT "controlled_document_versions_controlled_document_id_fk" FOREIGN KEY ("controlled_document_id") REFERENCES "controlled_documents"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "controlled_document_versions" ADD CONSTRAINT "controlled_document_versions_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "controlled_document_versions" ADD CONSTRAINT "controlled_document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "library_documents" ADD COLUMN IF NOT EXISTS "controlled_document_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_controlled_document_id_fk" FOREIGN KEY ("controlled_document_id") REFERENCES "controlled_documents"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD COLUMN IF NOT EXISTS "controlled_document_version_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_controlled_document_version_id_fk" FOREIGN KEY ("controlled_document_version_id") REFERENCES "controlled_document_versions"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "central_training_publications" ADD COLUMN IF NOT EXISTS "controlled_document_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "central_training_publications" ADD CONSTRAINT "central_training_publications_controlled_document_id_fk" FOREIGN KEY ("controlled_document_id") REFERENCES "controlled_documents"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE "training_document_versions" ADD COLUMN IF NOT EXISTS "controlled_document_version_id" uuid;
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "training_document_versions" ADD CONSTRAINT "training_document_versions_controlled_document_version_id_fk" FOREIGN KEY ("controlled_document_version_id") REFERENCES "controlled_document_versions"("id") ON DELETE restrict ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
