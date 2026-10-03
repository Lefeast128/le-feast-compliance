ALTER TABLE "catalogue_products" ADD COLUMN "wastage_category" text;--> statement-breakpoint
ALTER TABLE "catalogue_products" ADD COLUMN "excluded_from_wastage" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "catalogue_products" ADD COLUMN "wastage_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "catalogue_products" ADD COLUMN "wastage_reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD COLUMN "catalogue_product_id" uuid;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD COLUMN "catalogue_plu" integer;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD COLUMN "category_snapshot" text;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD COLUMN "wastage_source" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "catalogue_products" ADD CONSTRAINT "catalogue_products_wastage_reviewed_by_users_id_fk" FOREIGN KEY ("wastage_reviewed_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wastage_records" ADD CONSTRAINT "wastage_records_catalogue_product_id_catalogue_products_id_fk" FOREIGN KEY ("catalogue_product_id") REFERENCES "public"."catalogue_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalogue_products_wastage_picker_idx" ON "catalogue_products" USING btree ("location_id","active","excluded_from_wastage","plu");--> statement-breakpoint
CREATE INDEX "wastage_records_catalogue_product_idx" ON "wastage_records" USING btree ("catalogue_product_id");