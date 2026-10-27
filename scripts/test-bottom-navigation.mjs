import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const primitives = await readFile(new URL("../src/components/dashboard/DashboardPrimitives.tsx", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/pages/Dashboard.tsx", import.meta.url), "utf8");
const apiClient = await readFile(new URL("../src/lib/api-client.ts", import.meta.url), "utf8");
const today = await readFile(new URL("../src/components/dashboard/DashboardToday.tsx", import.meta.url), "utf8");
const journey = await readFile(new URL("../src/components/dashboard/DailyChecksJourney.tsx", import.meta.url), "utf8");
const profileMenu = await readFile(new URL("../src/components/dashboard/ProfileMenu.tsx", import.meta.url), "utf8");
const library = await readFile(new URL("../src/components/LibraryView.tsx", import.meta.url), "utf8");
const taskCard = await readFile(new URL("../src/components/dashboard/DailyTaskCard.tsx", import.meta.url), "utf8");
const workflows = await readFile(new URL("../src/components/dashboard/DashboardWorkflowScreens.tsx", import.meta.url), "utf8");
const taskIssueModal = await readFile(new URL("../src/components/TaskIssueModal.tsx", import.meta.url), "utf8");

for (const label of ["Daily Checks", "Library", "Calendar", "Admin"]) {
  assert.match(primitives, new RegExp(label), `${label} destination is preserved`);
}
assert.doesNotMatch(primitives, /Training.*GraduationCap/, "Training is no longer an independent tab");
assert.match(primitives, /items\.length === 4 \? "grid-cols-4" : "grid-cols-3"/, "three- and four-tab layouts are supported");
assert.match(primitives, /activeIndex = .*findIndex/, "active tab is resolved to a stable position");
assert.match(primitives, /translateX\(\$\{activeIndex \* 100\}%\)/, "selection capsule moves using a transform");
assert.match(primitives, /transition-transform duration-300 ease-\[cubic-bezier\(0\.22,1,0\.36,1\)\]/, "selection capsule uses a spring-like transition");
assert.match(primitives, /motion-reduce:transition-none/, "selection animation respects reduced motion");
assert.match(primitives, /active:scale-\[0\.94\]/, "tabs provide touch feedback");
assert.match(primitives, /aria-current=\{active === key \? "page" : undefined\}/, "current tab is announced semantically");
assert.match(primitives, /focus-visible:ring-2/, "keyboard focus remains visible");
assert.match(primitives, /safe-area-inset-bottom/, "navigation respects the bottom safe area");
assert.match(primitives, /print:hidden/, "navigation is hidden from printable inspection packs");
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
assert.match(dashboard, /activeNavigation = view === "training" \|\| view === "library" \? "library" : view === "calendar" \|\| view === "day" \? "calendar"/, "Training and archived days highlight their parent tab");
assert.match(dashboard, /view === "managerReviews" && capabilities\.canUseManagement/, "Manager Reviews highlights Admin only for authorised management users");
assert.match(dashboard, /onOpenTraining=\{\(\) => navigateTo\("training"\)\}/, "Library opens the preserved Training experience");
assert.match(dashboard, /onBack=\{\(\) => navigateTo\("library"\)\}/, "Training returns to Library");
assert.doesNotMatch(today, /<BottomNavigation /, "Daily Checks does not mount a duplicate navigation bar");
assert.doesNotMatch(library, /<BottomNavigation /, "Library does not mount a duplicate navigation bar");
for (const route of ["OperationalRecordsView", "TemperatureActionScreen", "TemperatureRoundEntry", "StructuredTaskWorkflow", "InlineCleaning", "InlineChecklist", "SecurityScreen", "MobileDayView", "AdditionalChecksView", "ManagerReviews"]) {
  assert.match(dashboard, new RegExp(`appShell\\(<${route}`), `${route} stays inside the shared navigation shell`);
}
assert.match(dashboard, /function navigateTo\(destination: DashboardView\)/, "navigation uses one central route handler");
assert.match(dashboard, /requestNavigation\(\(\) => \{ exitActiveWorkflow\(\); setView\(destination\); \}\)/, "Daily Checks navigation exits active workflows after confirmation");
assert.match(dashboard, /Unsubmitted values on this screen will be discarded/, "navigation warns before discarding unfinished work");
assert.match(dashboard, /AlertDialogCancel autoFocus>Stay/, "users can stay and retain the current workflow state");
assert.match(dashboard, /AlertDialogAction disabled=\{workflows\.roundSubmitting \|\| pendingMutations > 0\}/, "navigation cannot interrupt an active compliance submission");
assert.match(apiClient, /app:mutation-state/, "API writes publish an in-flight mutation count");
assert.match(dashboard, /app:mutation-state/, "navigation waits until any API write finishes");
assert.match(dashboard, /if \(workflows\.round \|\| structuredTaskArea \|\| workflows\.cleaningList \|\| workflows\.checklistList \|\| workflows\.security\) workflows\.resetForLocation\(\)/, "workflow state is cleared only after the user confirms leaving");
assert.match(dashboard, /onBack=\{\(\) => navigateTo\("today"\)\}/, "workflow back controls use the same unsaved-work guard");
assert.match(dashboard, /clearOfflineSession\(\)/, "store switching invalidates the previous offline session");
assert.match(primitives, /canUseManagement \? \[\["Admin"/, "Admin is only added for authorised users");
assert.doesNotMatch(today, /<Header/, "dashboard content no longer mounts the legacy dashboard header");
assert.doesNotMatch(journey, /Daily compliance journey|Internal compliance workspace|Your Daily Checks/, "dashboard no longer shows the legacy intro header");
assert.match(profileMenu, /Log out/, "logout remains accessible through the discreet account action");
assert.match(taskCard, /<button[\s\S]*aria-label=\{`\$\{task\.actionLabel\}: \$\{task\.title\}`\}/, "the entire task card is the action");
assert.match(taskCard, /<ChevronRight/, "task card has a navigation arrow");
assert.doesNotMatch(taskCard, /Step \$\{step\}|step:\s*number|<Button/, "task cards have no numbered marker or separate action button");
assert.match(taskCard, /icon === "temperature"/, "task cards use section icons");

console.log("Bottom navigation tests passed");
