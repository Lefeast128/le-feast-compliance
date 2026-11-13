import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calendarStatusLabel, createStoreDayTracker, storeLocalDateKey } from "../src/lib/store-operational-day.ts";
import { openingSnapshotForDate } from "../src/lib/offline/dashboard-snapshot.ts";

const beforeLondonMidnight = Date.parse("2026-11-05T23:59:30.000Z");
const afterLondonMidnight = Date.parse("2026-11-06T00:00:30.000Z");
assert.equal(storeLocalDateKey(beforeLondonMidnight, "Europe/London"), "2026-11-05");
assert.equal(storeLocalDateKey(afterLondonMidnight, "Europe/London"), "2026-11-06");
const london = createStoreDayTracker("Europe/London", beforeLondonMidnight);
assert.equal(london.refresh(beforeLondonMidnight + 20_000), false, "same operational day does not roll over");
assert.equal(london.refresh(afterLondonMidnight), true, "midnight rollover is detected when the timer runs");
assert.equal(london.currentDate, "2026-11-06");
const resumedLondon = createStoreDayTracker("Europe/London", beforeLondonMidnight);
assert.equal(resumedLondon.refresh(afterLondonMidnight), true, "a deterministic resume after store-local midnight triggers the same rollover without waiting for a timer");
assert.equal(resumedLondon.currentDate, "2026-11-06");

const losAngeles = createStoreDayTracker("America/Los_Angeles", afterLondonMidnight);
assert.equal(losAngeles.currentDate, "2026-11-05", "the date is computed in the selected store timezone, not browser timezone");
const beforeDstChange = Date.parse("2026-03-29T00:30:00.000Z");
const afterDstChange = Date.parse("2026-03-29T01:30:00.000Z");
assert.equal(storeLocalDateKey(beforeDstChange, "Europe/London"), "2026-03-29");
assert.equal(storeLocalDateKey(afterDstChange, "Europe/London"), "2026-03-29", "DST transition preserves the store-local day");
assert.equal(createStoreDayTracker("Asia/Tokyo", afterLondonMidnight).currentDate, "2026-11-06");
const snapshot = openingSnapshotForDate({
  location: { _id: "store-uk", name: "Store", timezone: "Europe/London" },
  checklists: { opening: { questions: [{ _id: "q1" }], responses: [{ questionId: "q1", answer: "yes", createdAt: "2026-11-05T12:00:00.000Z" }, { questionId: "q1", answer: "yes", createdAt: "2026-11-06T00:10:00.000Z" }] }, closing: { questions: [], responses: [] } },
  checklistSignOffs: [{ checklist: "opening", dateKey: "2026-11-05" }],
  structuredTasks: [{ _id: "task1", area: "opening", title: "Open" }],
  structuredTaskResponses: [{ _id: "old", taskArea: "opening", taskId: "task1", stepId: "simple", responseType: "confirm", responseValue: "confirmed", dateKey: "2026-11-05" }],
}, "2026-11-06");
assert.equal(snapshot.checklists.opening.questions.length, 1, "task configuration remains available in the offline snapshot");
assert.equal(snapshot.checklists.opening.responses.length, 1, "previous-day response is not presented as today's completion");
assert.equal(snapshot.checklistSignOffs?.length, 0, "previous-day sign-off is not carried forward");
assert.equal(snapshot.structuredTaskResponses.length, 0, "previous-day structured evidence is not carried forward");

assert.equal(calendarStatusLabel("red"), "Incomplete scheduled work");
assert.equal(calendarStatusLabel("green"), "Complete");
assert.equal(calendarStatusLabel("amber"), "Corrective action recorded");
const archiveService = await readFile(new URL("../src/server/history/service.ts", import.meta.url), "utf8");
assert.match(archiveService, /complete \? \(failed \? "amber" : "green"\) : "red"/, "incomplete historical days remain red while complete days remain green or corrective-action amber");
assert.match(archiveService, /date > localDateKey\(Date\.now\(\), location\.timezone\) \? "grey"/, "future-date status is calculated in the store timezone");

const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const calendar = await readFile(new URL("../src/components/dashboard/CalendarView.tsx", import.meta.url), "utf8");
const restDomain = await readFile(new URL("../src/lib/rest-domain.ts", import.meta.url), "utf8");
assert.match(dashboard, /setInterval\(refreshForNewDay, 30_000\)/, "open app checks for store-local midnight rollover");
assert.match(dashboard, /addEventListener\("pageshow", refreshOnResume\)/, "app refreshes after page resume");
assert.match(dashboard, /addEventListener\("visibilitychange", refreshWhenVisible\)/, "app refreshes when it becomes visible again");
assert.match(dashboard, /dashboard:\$\{currentLocationId\}:\$\{operationalDate\}/, "a new store-local date forces today's dashboard query to reload");
assert.match(dashboard, /setOfflineDashboard\(currentLocationId \? readOpeningSnapshot\(currentLocationId\) : null\);[\s\S]*\}, \[currentLocationId, operationalDate\]\)/, "offline opening data is re-evaluated at rollover without carrying yesterday's responses forward");
assert.match(dashboard, /setSelectedDay\(date\); setView\("day"\)/, "calendar selection opens the exact selected historical date");
assert.match(dashboard, /archive:\$\{dashboard\.location\._id\}:\$\{selectedDay\}/, "archive data remains keyed to the deliberate calendar selection");
assert.match(archiveService, /status: calendarDay\?\.status === "green" \? "complete"/, "archive summary uses the same historical calendar status");
assert.match(calendar, /Incomplete scheduled work — open date to review its original records/, "incomplete dates are clearly explained");
assert.match(calendar, /incomplete \? "border-2 border-\[#c85a4b\] bg-\[#fff1ee\]"/, "incomplete dates have a strong visible cell marker");
assert.match(calendar, /incomplete \? "Incomplete"/, "incomplete label remains visible at phone widths");
assert.match(calendar, /Calendar status could not be loaded/, "API errors are not presented as dates with no recorded status");
assert.match(calendar, /Loading calendar status/, "calendar loading is not represented as zero or empty status");
assert.match(calendar, /aria-label=\{`\$\{key\}: \$\{status\}/, "date status is accessible on touch and keyboard devices");
assert.match(calendar, /min-h-20[\s\S]*sm:min-h-20/, "calendar cells retain touch targets on phones and desktop");
assert.match(restDomain, /snapshot\?\.key === key \? snapshot\.value : undefined/, "data from the previous date or store is not rendered as current while refreshing");

console.log("Operational day rollover and Calendar tests passed");
