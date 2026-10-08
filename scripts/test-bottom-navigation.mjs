import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const primitives = await readFile(new URL("../src/components/dashboard/DashboardPrimitives.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const today = await readFile(new URL("../src/components/dashboard/DashboardToday.tsx", import.meta.url), "utf8");
const library = await readFile(new URL("../src/components/LibraryView.tsx", import.meta.url), "utf8");
const workflows = await readFile(new URL("../src/components/dashboard/DashboardWorkflowScreens.tsx", import.meta.url), "utf8");
const taskIssueModal = await readFile(new URL("../src/components/TaskIssueModal.tsx", import.meta.url), "utf8");

for (const label of ["Daily Checks", "Calendar", "Training", "Library", "Admin"]) {
  assert.match(primitives, new RegExp(label), `${label} destination is preserved`);
}
assert.match(primitives, /items\.length === 4 \? "grid-cols-4" : "grid-cols-5"/, "four- and five-tab layouts are supported");
assert.match(primitives, /activeIndex = .*findIndex/, "active tab is resolved to a stable position");
assert.match(primitives, /translateX\(\$\{activeIndex \* 100\}%\)/, "selection capsule moves using a transform");
assert.match(primitives, /transition-transform duration-300 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]/, "selection capsule uses a spring-like transition");
assert.match(primitives, /motion-reduce:transition-none/, "selection animation respects reduced motion");
assert.match(primitives, /active:scale-\[0\.94\]/, "tabs provide touch feedback");
assert.match(primitives, /aria-current=\{active === key \? "page" : undefined\}/, "current tab is announced semantically");
assert.match(primitives, /focus-visible:ring-2/, "keyboard focus remains visible");
assert.match(primitives, /safe-area-inset-bottom/, "navigation respects the bottom safe area");
assert.match(primitives, /backdrop-blur-xl/, "navigation uses translucent blur treatment");
assert.match(primitives, /fixed inset-x-0 bottom-0 z-20/, "navigation sits below modal overlays");
assert.match(primitives, /fixed inset-0 z-30/, "shared modal backdrop sits above navigation");
assert.match(workflows, /<Modal/, "food probe uses the shared modal layer");
assert.match(taskIssueModal, /fixed inset-0 z-30/, "issue reporting overlay also blocks navigation");
assert.match(today, /onClose=\{\(\) => \{[\s\S]*setProbeOpen\(false\)/, "probe dismissal restores the main navigation state");
assert.equal((dashboard.match(/<BottomNavigation /g) ?? []).length, 1, "Dashboard owns one persistent navigation bar");
assert.match(dashboard, /const mainView = view === "calendar"/, "main destinations share a parent shell");
assert.match(dashboard, /activeNavigation = view === "calendar" \|\| view === "training" \|\| view === "library" \|\| view === "admin"/, "main tab active state follows the current view");
assert.doesNotMatch(today, /<BottomNavigation /, "Daily Checks does not mount a duplicate navigation bar");
assert.doesNotMatch(library, /<BottomNavigation /, "Library does not mount a duplicate navigation bar");
assert.match(dashboard, /if \(workflows\.round/, "focused temperature workflows remain outside the main navigation shell");
assert.match(dashboard, /if \(structuredTaskArea\)/, "focused structured workflows remain outside the main navigation shell");
assert.match(dashboard, /if \(workflows\.cleaningList\)/, "focused cleaning workflows remain outside the main navigation shell");
assert.match(dashboard, /if \(workflows\.checklistList\)/, "focused checklist workflows remain outside the main navigation shell");
assert.match(dashboard, /if \(workflows\.security/, "focused security workflows remain outside the main navigation shell");
assert.match(primitives, /canUseManagement \? \[\["Admin"/, "Admin is only added for authorised users");

console.log("Bottom navigation tests passed");
