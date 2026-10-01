ALTER TABLE "equipment" ALTER COLUMN "preferred_temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "equipment" ALTER COLUMN "maximum_temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "food_checks" ALTER COLUMN "temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "food_checks" ALTER COLUMN "minimum_temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "probe_products" ALTER COLUMN "minimum_temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "rechecks" ALTER COLUMN "temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "temperature_readings" ALTER COLUMN "temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "temperature_readings" ALTER COLUMN "preferred_temperature" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "temperature_readings" ALTER COLUMN "maximum_temperature" SET DATA TYPE real;