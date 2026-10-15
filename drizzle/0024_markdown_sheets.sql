CREATE TABLE IF NOT EXISTS "markdown_products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_products_location_order_idx" ON "markdown_products" ("location_id", "active", "sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "markdown_sheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "date_key" text NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "markdown_sheets_location_day_idx" ON "markdown_sheets" ("location_id", "date_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "markdown_sheet_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sheet_id" uuid NOT NULL REFERENCES "markdown_sheets"("id") ON DELETE RESTRICT,
  "location_id" uuid NOT NULL REFERENCES "locations"("id") ON DELETE RESTRICT,
  "product_id" uuid NOT NULL REFERENCES "markdown_products"("id") ON DELETE RESTRICT,
  "mode" text NOT NULL,
  "quantity" integer DEFAULT 0 NOT NULL,
  "completed_at" timestamptz,
  "completed_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "completed_team_member_id" uuid REFERENCES "team_members"("id") ON DELETE RESTRICT,
  "reviewed_at" timestamptz,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "markdown_sheet_items_sheet_product_mode_idx" ON "markdown_sheet_items" ("sheet_id", "product_id", "mode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "markdown_sheet_items_location_created_idx" ON "markdown_sheet_items" ("location_id", "created_at");
