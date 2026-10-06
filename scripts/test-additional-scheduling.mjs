import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { nextAdditionalDue, validateAdditionalSchedule } from "../src/server/additional/scheduling.ts";

const due = new Date("2026-01-06T12:00:00.000Z");
const weekly = validateAdditionalSchedule({ frequency: "weekly", nextDueAt: due, weekdays: [4, 2] });
assert.deepEqual(weekly.weekdays, [2, 4]);
assert.equal(nextAdditionalDue(weekly, due).toISOString(), "2026-01-08T12:00:00.000Z");
assert.throws(() => validateAdditionalSchedule({ frequency: "weekly", nextDueAt: due, weekdays: [] }), /weekday/);
const everyTwo = validateAdditionalSchedule({ frequency: "every_x_weeks", interval: 2, nextDueAt: due, weekdays: [2, 4] });
assert.equal(nextAdditionalDue(everyTwo, due).toISOString(), "2026-01-20T12:00:00.000Z");
assert.equal(validateAdditionalSchedule({ frequency: "monthly", nextDueAt: due, dayOfMonth: 15 }).nextDueAt.getUTCDate(), 15);
assert.equal(validateAdditionalSchedule({ frequency: "monthly", nextDueAt: due, dayOfMonth: 15 }).dayOfMonth, 15);
assert.equal(validateAdditionalSchedule({ frequency: "every_x_months", interval: 3, nextDueAt: due, dayOfMonth: 15 }).interval, 3);
assert.equal(validateAdditionalSchedule({ frequency: "annual", nextDueAt: due }).nextDueAt.toISOString(), due.toISOString());
assert.equal(validateAdditionalSchedule({ frequency: "one_off", nextDueAt: due }).frequency, "one_off");
assert.throws(() => validateAdditionalSchedule({ frequency: "every_x_months", interval: 0, nextDueAt: due, dayOfMonth: 1 }), /Interval/);
assert.throws(() => validateAdditionalSchedule({ frequency: "monthly", nextDueAt: due, dayOfMonth: 32 }), /Day of month/);

const admin = await readFile("src/components/AdditionalAdmin.tsx", "utf8");
const schedule = await readFile("src/components/AdditionalScheduleFields.tsx", "utf8");
const service = await readFile("src/server/additional/service.ts", "utf8");
assert.match(schedule, /Runs on/);
assert.match(schedule, /aria-pressed/);
assert.match(admin, /AdditionalScheduleFields/);
assert.match(service, /validateAdditionalSchedule/);
assert.match(service, /nextAdditionalDue/);
console.log("Additional scheduling tests passed");
