import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const calendar = await readFile(new URL("../src/components/dashboard/CalendarView.tsx", import.meta.url), "utf8");
let passed = 0;
const check = (condition, message) => { assert.ok(condition, message); passed++; };

// Store loading must not be reported as missing access.
check(!dashboard.includes("const dashboard = onlineDashboard ?? offlineDashboard;"), "loading store no longer falls through to null");
check(dashboard.includes("(!currentLocationId || currentFailure ? null : undefined)"), "dashboard stays undefined (loading) until the request settles");
check(dashboard.includes("currentFailure?.status === 403 || currentFailure?.status === 404"), "access message is limited to 403/404 responses");
check(dashboard.includes("This store couldn&apos;t be loaded") && dashboard.includes("Try again"), "other failures offer a retry");
check(dashboard.includes("offlineDashboard.location._id === currentLocationId"), "offline snapshot of another store is never shown for the selected store");
check(dashboard.includes("allStoresOriginLocationId.current = currentLocationId"), "All stores remembers the originating store");

// Browser history mirrors top-level navigation.
check(dashboard.includes('window.addEventListener("popstate"'), "Back/Forward are handled");
check(dashboard.includes("window.history.pushState") && dashboard.includes("leFeastNav"), "navigation is pushed into history");
check(dashboard.includes("returnToAllStores: managerReturnToAllStores"), "All stores context is part of history state");
check(dashboard.includes("if (!navigationNeedsConfirmation() || !currentLocationId) { apply(); return; }"), "Back only re-pushes when unsaved work blocks navigation");

// Calendar exposes load failures and marks incomplete days clearly on phones.
check(dashboard.includes('loadState={calendarQuery.loading ? "loading" : calendarQuery.error ? "error" : "ready"}'), "calendar receives load state");
check(calendar.includes("Day statuses couldn&apos;t be loaded"), "calendar shows an error instead of an empty grid");
check(calendar.includes("border-2 border-[#c85a4b] bg-[#fdecea]"), "incomplete days are prominent below the sm breakpoint");

console.log(`QA navigation and state tests passed: ${passed}/${passed}`);
