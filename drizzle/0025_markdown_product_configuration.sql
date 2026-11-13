ALTER TABLE "markdown_products" ADD COLUMN IF NOT EXISTS "catalogue_product_id" uuid REFERENCES "catalogue_products"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "markdown_products" ADD COLUMN IF NOT EXISTS "quick_select" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "markdown_products" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'custom' NOT NULL;
--> statement-breakpoint
ALTER TABLE "markdown_products" ADD COLUMN IF NOT EXISTS "temporary_date_key" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_products_catalogue_idx" ON "markdown_products" ("location_id", "catalogue_product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_products_quick_select_idx" ON "markdown_products" ("location_id", "quick_select", "active", "sort_order");
