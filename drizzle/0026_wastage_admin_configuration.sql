CREATE TABLE IF NOT EXISTS "wastage_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wastage_items" ADD COLUMN IF NOT EXISTS "category" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wastage_categories_location_order_idx" ON "wastage_categories" ("location_id", "active", "sort_order");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wastage_items_location_category_idx" ON "wastage_items" ("location_id", "category");
