import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleaningEvidenceStatus, cleaningIsScheduledForDate, cleaningRunsOn, cleaningWeekdaySummary, normalizeCleaningWeekdays } from "../src/shared/cleaning-scheduling.ts";

assert.equal(cleaningRunsOn("weekly", [2, 4], 2), true, "weekly task is due on configured Tuesday");
assert.equal(cleaningRunsOn("weekly", [2, 4], 4), true, "weekly task is due on configured Thursday");
assert.equal(cleaningRunsOn("weekly", [2, 4], 1), false, "weekly task is not due on an unselected day");
assert.equal(cleaningRunsOn("specific_days", [0, 6], 1), false, "specific-day task is not due on another day");
assert.equal(cleaningRunsOn("daily", [], 5), true, "daily task remains due every day");
assert.deepEqual(normalizeCleaningWeekdays("weekly", []), [1], "legacy empty weekly records retain Monday compatibility");
assert.equal(cleaningWeekdaySummary("weekly", [2, 4]), "Tuesday, Thursday");
assert.equal(cleaningEvidenceStatus("after_use", [], "2026-07-15", "Europe/London"), "not_verifiable", "after-use cleaning is not claimed missed without usage evidence");
assert.equal(cleaningIsScheduledForDate("weekly", [2, 4], "2026-07-14", "Europe/London"), true, "configured weekly Tuesday is scheduled");
assert.equal(cleaningIsScheduledForDate("weekly", [2, 4], "2026-07-13", "Europe/London"), false, "configured weekly Monday is not scheduled");
assert.equal(cleaningIsScheduledForDate("weekly", [], "2026-07-13", "Europe/London"), true, "legacy empty weekly schedule keeps Monday compatibility");
assert.equal(cleaningEvidenceStatus("specific_days", [0, 6], "2026-07-11", "Europe/London"), "scheduled", "specific-day Saturday schedule uses local date");
assert.equal(cleaningEvidenceStatus("specific_days", [0, 6], "2026-07-12", "America/New_York"), "scheduled", "store timezone is used for date scheduling");
assert.equal(cleaningEvidenceStatus("daily", [], "2026-03-29", "Europe/London"), "scheduled", "DST spring transition retains daily scheduling");
assert.equal(cleaningEvidenceStatus("daily", [], "2026-10-25", "Europe/London"), "scheduled", "DST autumn transition retains daily scheduling");

const repository = await readFile(new URL("../src/server/dashboard/repository.ts", import.meta.url), "utf8");
const management = await readFile(new URL("../src/server/management/cleaning-service.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../src/components/admin/AdminStoreOverview.tsx", import.meta.url), "utf8");
const editor = await readFile(new URL("../src/components/CleaningScheduleFields.tsx", import.meta.url), "utf8");
assert.match(repository, /cleaningRunsOn/);
assert.match(management, /Select at least one cleaning weekday/);
assert.match(editor, /aria-pressed/);
assert.match(admin, /cleaningWeekdaySummary/);
console.log("Cleaning schedule tests passed: daily, weekly, multi-day, legacy compatibility and manager controls");
