CREATE TABLE IF NOT EXISTS "library_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "category" text NOT NULL,
  "important" boolean NOT NULL DEFAULT false,
  "location_ids" jsonb NOT NULL,
  "allocation_mode" "central_allocation_mode" NOT NULL DEFAULT 'selected',
  "active" boolean NOT NULL DEFAULT true,
  "created_by" uuid NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_documents_organisation_active_idx" ON "library_documents" USING btree ("organisation_id", "active");
--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_document_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "library_document_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_document_versions_document_version_idx" ON "library_document_versions" USING btree ("library_document_id", "version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_document_versions_document_idx" ON "library_document_versions" USING btree ("document_id");
--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_library_document_id_library_documents_id_fk" FOREIGN KEY ("library_document_id") REFERENCES "library_documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "library_document_versions" ADD CONSTRAINT "library_document_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;
