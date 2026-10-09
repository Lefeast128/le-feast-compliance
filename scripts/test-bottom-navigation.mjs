import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const primitives = await readFile(new URL("../src/components/dashboard/DashboardPrimitives.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const today = await readFile(new URL("../src/components/dashboard/DashboardToday.tsx", import.meta.url), "utf8");
const journey = await readFile(new URL("../src/components/dashboard/DailyChecksJourney.tsx", import.meta.url), "utf8");
const library = await readFile(new URL("../src/components/LibraryView.tsx", import.meta.url), "utf8");
const taskCard = await readFile(new URL("../src/components/dashboard/DailyTaskCard.tsx", import.meta.url), "utf8");
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
assert.match(primitives, /backdrop-blur-\[32px\]/, "navigation uses strengthened translucent blur treatment");
assert.match(primitives, /backdrop-saturate-150/, "navigation increases glass saturation");
assert.match(primitives, /bg-white\/\[0\.78\]/, "navigation has a readable fallback glass surface");
assert.match(primitives, /supports-\[backdrop-filter\]:bg-white\/\[0\.26\]/, "navigation becomes more transparent when blur is supported");
assert.match(primitives, /border-white\/45/, "navigation has a restrained glass border");
assert.match(primitives, /bg-brand-yellow\/75/, "active capsule uses the shared brand yellow");
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
assert.doesNotMatch(today, /<Header/, "dashboard content no longer mounts the legacy dashboard header");
assert.doesNotMatch(journey, /Daily compliance journey|Internal compliance workspace|Your Daily Checks/, "dashboard no longer shows the legacy intro header");
assert.match(journey, /aria-label="Sign out"/, "logout remains accessible through the discreet account action");
assert.match(taskCard, /<button[\s\S]*aria-label=\{`\$\{task\.actionLabel\}: \$\{task\.title\}`\}/, "the entire task card is the action");
assert.match(taskCard, /<ChevronRight/, "task card has a navigation arrow");
assert.doesNotMatch(taskCard, /Step \$\{step\}|step:\s*number|<Button/, "task cards have no numbered marker or separate action button");
assert.match(taskCard, /icon === "temperature"/, "task cards use section icons");

console.log("Bottom navigation tests passed");
