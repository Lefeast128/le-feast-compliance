-- References only: preserve existing products, transactions and favourites.
ALTER TABLE "markdown_products" ADD COLUMN IF NOT EXISTS "wastage_item_id" uuid REFERENCES "wastage_items"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "markdown_products_wastage_item_idx" ON "markdown_products" ("location_id", "wastage_item_id");
--> statement-breakpoint
ALTER TABLE "wastage_records" ADD COLUMN IF NOT EXISTS "markdown_product_id" uuid REFERENCES "markdown_products"("id") ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wastage_records_markdown_product_idx" ON "wastage_records" ("markdown_product_id");
