CREATE INDEX "locations_organisation_active_idx" ON "locations" USING btree ("organisation_id", "active");
--> statement-breakpoint
CREATE INDEX "temperature_rounds_location_started_idx" ON "temperature_rounds" USING btree ("location_id", "started_at");
--> statement-breakpoint
CREATE INDEX "temperature_readings_location_created_idx" ON "temperature_readings" USING btree ("location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "checklist_responses_location_created_idx" ON "checklist_responses" USING btree ("location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "security_responses_location_created_idx" ON "security_responses" USING btree ("location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "food_checks_location_created_idx" ON "food_checks" USING btree ("location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "wastage_records_location_created_idx" ON "wastage_records" USING btree ("location_id", "created_at");
--> statement-breakpoint
CREATE INDEX "cleaning_completions_location_date_idx" ON "cleaning_completions" USING btree ("location_id", "date_key");
--> statement-breakpoint
CREATE INDEX "training_completions_location_member_idx" ON "training_completions" USING btree ("location_id", "team_member_id");
--> statement-breakpoint
CREATE INDEX "training_completions_requirement_idx" ON "training_completions" USING btree ("requirement_id");
--> statement-breakpoint
CREATE INDEX "additional_requirements_location_due_idx" ON "additional_requirements" USING btree ("location_id", "active", "next_due_at");
--> statement-breakpoint
CREATE INDEX "additional_completions_location_completed_idx" ON "additional_completions" USING btree ("location_id", "completed_at");
--> statement-breakpoint
CREATE INDEX "additional_completions_requirement_completed_idx" ON "additional_completions" USING btree ("requirement_id", "completed_at");
--> statement-breakpoint
CREATE INDEX "issues_location_status_created_idx" ON "issues" USING btree ("location_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX "issue_updates_issue_created_idx" ON "issue_updates" USING btree ("issue_id", "created_at");
--> statement-breakpoint
CREATE INDEX "issue_updates_location_created_idx" ON "issue_updates" USING btree ("location_id", "created_at");
