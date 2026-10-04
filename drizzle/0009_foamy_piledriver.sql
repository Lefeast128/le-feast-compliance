ALTER TABLE "equipment" ADD COLUMN "minimum_temperature" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "temperature_readings" ADD COLUMN "minimum_temperature" real;