import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cleaningRunsOn, cleaningWeekdaySummary, normalizeCleaningWeekdays } from "../src/shared/cleaning-scheduling.ts";

assert.equal(cleaningRunsOn("weekly", [2, 4], 2), true, "weekly task is due on configured Tuesday");
assert.equal(cleaningRunsOn("weekly", [2, 4], 4), true, "weekly task is due on configured Thursday");
assert.equal(cleaningRunsOn("weekly", [2, 4], 1), false, "weekly task is not due on an unselected day");
assert.equal(cleaningRunsOn("specific_days", [0, 6], 1), false, "specific-day task is not due on another day");
assert.equal(cleaningRunsOn("daily", [], 5), true, "daily task remains due every day");
assert.deepEqual(normalizeCleaningWeekdays("weekly", []), [1], "legacy empty weekly records retain Monday compatibility");
assert.equal(cleaningWeekdaySummary("weekly", [2, 4]), "Tuesday, Thursday");

const repository = await readFile(new URL("../src/server/dashboard/repository.ts", import.meta.url), "utf8");
const management = await readFile(new URL("../src/server/management/cleaning-service.ts", import.meta.url), "utf8");
const admin = await readFile(new URL("../src/components/admin/AdminStoreOverview.tsx", import.meta.url), "utf8");
const editor = await readFile(new URL("../src/components/CleaningScheduleFields.tsx", import.meta.url), "utf8");
assert.match(repository, /cleaningRunsOn/);
assert.match(management, /Select at least one cleaning weekday/);
assert.match(editor, /aria-pressed/);
assert.match(admin, /cleaningWeekdaySummary/);
console.log("Cleaning schedule tests passed: daily, weekly, multi-day, legacy compatibility and manager controls");
