import AdminSetup from "@/components/AdminSetup";
import AdditionalChecksView from "@/components/AdditionalChecksView";
import InlineChecklist from "@/components/InlineChecklist";
import InlineCleaning from "@/components/InlineCleaning";
import MobileDayView from "@/components/MobileDayView";
import ManagerReviews from "@/components/ManagerReviews";
import TrainingView from "@/components/TrainingView";
import LibraryView from "@/components/LibraryView";
import TemperatureActionScreen from "@/components/TemperatureActionScreen";
import TemperatureRoundEntry from "@/components/TemperatureRoundEntry";
import StructuredTaskWorkflow from "@/components/StructuredTaskWorkflow";
import CalendarView from "@/components/dashboard/CalendarView";
import DashboardToday, { type DashboardTodayProps } from "@/components/dashboard/DashboardToday";
import { BottomNavigation } from "@/components/dashboard/DashboardPrimitives";
import { SecurityScreen } from "@/components/dashboard/DashboardWorkflowScreens";
import OperationalRecordsView from "@/components/dashboard/OperationalRecordsView";
import { useDashboardWorkflows } from "@/components/dashboard/useDashboardWorkflows";
import type { ManagerOverviewSection, ManagerOverviewTarget } from "@/lib/manager-overview";
import { toast } from "sonner";
import type { CalendarDay, DashboardData, DashboardLocation, DashboardView, ManagerReviewStatus } from "@/components/dashboard/dashboard-types";
import { useAuth } from "@/hooks/use-auth";
import { restApi, useRestQuery, useRestQueryState } from "@/lib/rest-domain";
import { getInFlightMutationCount } from "@/lib/api-client";
import { formatDateKey } from "@/lib/date-key";
import { getRoleCapabilities } from "@/lib/role-capabilities";
import { clearOfflineSession, establishOfflineSession, readOfflineSession } from "@/lib/offline/device-session";
import { readOpeningSnapshot, writeOpeningSnapshot } from "@/lib/offline/dashboard-snapshot";
import { useState, useEffect, useRef } from "react";
import type { ReactNode, SetStateAction } from "react";
import ShiftHandoverPanel, { type HandoverData } from "@/components/ShiftHandoverPanel";
import ProfileMenu from "@/components/dashboard/ProfileMenu";
import logo from "@/assets/logo.svg";
import MarkdownSheetPanel from "@/components/MarkdownSheetPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { createStoreDayTracker, storeLocalDateKey } from "@/lib/store-operational-day";
import { shouldConfirmAppNavigation } from "@/lib/navigation-guard";

const monthBounds = (value: Date) => ({ start: formatDateKey(new Date(value.getFullYear(), value.getMonth(), 1)), end: formatDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0)) });
const AccessDenied = () => <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="rounded-2xl border border-[#efc8c3] bg-white px-6 py-5 text-center"><p className="font-semibold">Management access required</p><p className="mt-1 text-sm text-[#727a74]">This area is only available to managers for their assigned stores.</p></div></div>;

type AppHistoryState = { view: DashboardView; locationId: string; allStores: boolean; returnToAllStores: boolean };
const sameHistoryState = (a: AppHistoryState, b: AppHistoryState) => a.view === b.view && a.locationId === b.locationId && a.allStores === b.allStores && a.returnToAllStores === b.returnToAllStores;

export default function Dashboard() {
  const { logout, user, memberships } = useAuth();
  const [renderTimestamp] = useState(() => Date.now());
  const [locationId, setLocationId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("today");
  const [navigationRequest, setNavigationRequest] = useState<{ run: (() => void) | null } | null>(null);
  const [pendingMutations, setPendingMutations] = useState(getInFlightMutationCount);
  const [structuredTaskArea, setStructuredTaskArea] = useState<"opening" | "closing" | "cleaning" | "security_am" | "security_pm" | null>(null);
  const [managerSection, setManagerSection] = useState<ManagerOverviewSection>("overview");
  const [managerAllStores, setManagerAllStores] = useState(false);
  const [managerReturnToAllStores, setManagerReturnToAllStores] = useState(false);
  const allStoresOriginLocationId = useRef<string | null>(null);
  const [managerReviewsDirty, setManagerReviewsDirty] = useState(false);
  const [adminHasUnsavedChanges, setAdminHasUnsavedChanges] = useState(false);
  const [workflowReturnView, setWorkflowReturnView] = useState<DashboardView>("today");
  const [managerCleaningTaskId, setManagerCleaningTaskId] = useState<string | undefined>();
  const [managerAdditionalRequirementId, setManagerAdditionalRequirementId] = useState<string | undefined>();
  const [pendingManagerTarget, setPendingManagerTarget] = useState<{ locationId: string; target: ManagerOverviewTarget } | null>(null);
  const [recordView, setRecordView] = useState<{ kind: "temperature" | "checklist" | "security" | "cleaning" | "probes" | "wastage"; session?: "AM" | "PM"; checklist?: "opening" | "closing" } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const bounds = monthBounds(calendarMonth);
  const locations = useRestQuery<DashboardLocation[]>("locations", restApi.locations.myLocations, true);
  useEffect(() => {
    const update = (event: Event) => setPendingMutations((event as CustomEvent<{ pending: number }>).detail.pending);
    window.addEventListener("app:mutation-state", update);
    return () => window.removeEventListener("app:mutation-state", update);
  }, []);
  const currentLocationId = locationId ?? locations?.[0]?._id ?? readOfflineSession()?.locationId ?? null;
  const capabilities = getRoleCapabilities(user, memberships, currentLocationId);
  const [offlineDashboard, setOfflineDashboard] = useState<DashboardData | null>(null);
  const selectedStoreTimeZone = locations?.find(location => location._id === currentLocationId)?.timezone ?? offlineDashboard?.location.timezone ?? "Europe/London";
  const [operationalDate, setOperationalDate] = useState(() => storeLocalDateKey(Date.now(), selectedStoreTimeZone));
  const dayTracker = useRef(createStoreDayTracker(selectedStoreTimeZone));
  useEffect(() => {
    const tracker = createStoreDayTracker(selectedStoreTimeZone);
    dayTracker.current = tracker;
    // The timezone can change when the selected store changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOperationalDate(tracker.currentDate);
    const refreshForNewDay = () => {
      if (dayTracker.current.refresh()) setOperationalDate(dayTracker.current.currentDate);
    };
    const refreshOnResume = () => {
      if (!dayTracker.current.refresh()) window.dispatchEvent(new Event("rest:data-changed"));
      else setOperationalDate(dayTracker.current.currentDate);
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshOnResume(); };
    const timer = window.setInterval(refreshForNewDay, 30_000);
    window.addEventListener("focus", refreshOnResume);
    window.addEventListener("pageshow", refreshOnResume);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnResume);
      window.removeEventListener("pageshow", refreshOnResume);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [selectedStoreTimeZone]);
  const dashboardKey = currentLocationId ? `dashboard:${currentLocationId}:${operationalDate}` : null;
  // Track why the selected store failed to load, so a slow or failed request is not
  // mistaken for the account having no store access.
  const [dashboardFailure, setDashboardFailure] = useState<{ key: string; status: number | null } | null>(null);
  const onlineDashboard = useRestQuery<DashboardData | null>(dashboardKey, () => restApi.compliance.dashboard({ locationId: currentLocationId }).then((value: DashboardData | null) => {
    setDashboardFailure(null);
    return value;
  }).catch((error: unknown) => {
    if (dashboardKey) setDashboardFailure({ key: dashboardKey, status: typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : null });
    throw error;
  }), Boolean(currentLocationId));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfflineDashboard(currentLocationId ? readOpeningSnapshot(currentLocationId) : null);
  }, [currentLocationId, operationalDate]);
  useEffect(() => {
    if (onlineDashboard && user?.organisationId && currentLocationId) {
      establishOfflineSession(user, currentLocationId, memberships);
      writeOpeningSnapshot(onlineDashboard);
    }
  }, [currentLocationId, memberships, onlineDashboard, user]);
  const currentFailure = dashboardFailure && dashboardFailure.key === dashboardKey ? dashboardFailure : null;
  // A store transition can render once before the offline snapshot effect and
  // the keyed online request finish. Never present the previous store's data
  // as if it belonged to the newly selected store, and never let a cached
  // offline snapshot override a server answer (including a denial).
  const dashboardCandidate = onlineDashboard === undefined ? offlineDashboard : onlineDashboard;
  const matchingDashboard = dashboardCandidate?.location._id === currentLocationId ? dashboardCandidate : null;
  // undefined = still loading; null = no store selected, denied, or the store could not be loaded.
  const dashboard = matchingDashboard ?? (!currentLocationId || onlineDashboard === null || currentFailure ? null : undefined);
  const storeAccessDenied = !currentLocationId || onlineDashboard === null || currentFailure?.status === 403 || currentFailure?.status === 404;

  const handover = useRestQuery<HandoverData | null>(currentLocationId ? `handover:${currentLocationId}` : null, () => restApi.compliance.handover.list({ locationId: currentLocationId! }), Boolean(currentLocationId));
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverMorningPrompt, setHandoverMorningPrompt] = useState<number | null>(null);
  const handoverTimezone = dashboard?.location.timezone ?? locations?.find(location => location._id === currentLocationId)?.timezone ?? "Europe/London";
  /* eslint-disable react-hooks/set-state-in-effect -- prompt state mirrors localStorage and server unread state. */
  useEffect(() => {
    if (!handover?.unreadCount || !user?.id || !currentLocationId) { setHandoverMorningPrompt(null); return; }
    const key = `mise.handover.morning:${user.id}:${currentLocationId}:${storeLocalDateKey(Date.now(), handoverTimezone)}`;
    if (window.localStorage.getItem(key)) { setHandoverMorningPrompt(null); return; }
    setHandoverMorningPrompt(handover.unreadCount);
  }, [currentLocationId, handover?.unreadCount, handoverTimezone, user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Reset transient panel state when the operator changes stores.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHandoverOpen(false);
    setHandoverMorningPrompt(null);
  }, [currentLocationId]);
  const handleMorningPromptAction = (action: "view" | "later") => {
    if (user?.id && currentLocationId) window.localStorage.setItem(`mise.handover.morning:${user.id}:${currentLocationId}:${storeLocalDateKey(Date.now(), handoverTimezone)}`, "1");
    setHandoverMorningPrompt(null);
    if (action === "view") setHandoverOpen(true);
  };
  const refreshHandover = () => window.dispatchEvent(new Event("rest:data-changed"));
  const activeNavigation = view === "training" || view === "library" ? "library" : view === "calendar" || view === "day" ? "calendar" : view === "admin" || (view === "managerReviews" && capabilities.canUseManagement) ? "admin" : "today";
  const appShell = (content: ReactNode) => <div className="min-h-screen bg-white pb-[calc(8rem+env(safe-area-inset-bottom))]"><header className="print:hidden"><div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-4"><div className="flex min-w-0 items-center gap-2"><img src={logo} alt="mise." width={32} height={32} className="size-8 shrink-0 rounded-lg" /><div className="min-w-0 leading-none"><p className="truncate text-[15px] font-bold tracking-tight text-[#202522]">mise.</p><p className="mt-1 text-[9px] font-medium tracking-wide text-[#727a74]">by Le Feast</p></div></div><div className="flex items-center gap-1"><ShiftHandoverPanel locationId={currentLocationId ?? dashboard?.location._id ?? ""} data={handover ?? undefined} userId={user?.id} teamMembers={dashboard?.teamMembers ?? []} canModerate={capabilities.canViewManagerReviews} open={handoverOpen} onOpenChange={setHandoverOpen} onRefresh={refreshHandover} morningPrompt={handoverMorningPrompt} onMorningPromptAction={handleMorningPromptAction} /><MarkdownSheetPanel locationId={currentLocationId ?? dashboard?.location._id ?? ""} locationName={dashboard?.location.name ?? "Store"} timeZone={handoverTimezone} teamMembers={dashboard?.teamMembers ?? []} canManageProducts={capabilities.canUseManagement} /><ProfileMenu user={user!} memberships={memberships} locations={locations ?? []} currentLocationId={currentLocationId} onLocationChange={switchLocation} onManagerReviews={() => openManagerReviews()} onAdmin={openManagementView} onLogout={logout} /></div></div></header>{content}<BottomNavigation onToday={() => navigateTo("today")} onLibrary={() => navigateTo("library")} onCalendar={() => navigateTo("calendar")} onAdmin={openManagementView} canUseManagement={capabilities.canUseManagement} active={activeNavigation} /><AlertDialog open={Boolean(navigationRequest)} onOpenChange={open => { if (!open) setNavigationRequest(null); }}><AlertDialogContent className="z-[60]"><AlertDialogHeader><AlertDialogTitle>{workflows.roundSubmitting || pendingMutations > 0 ? "Please wait" : "Leave this screen?"}</AlertDialogTitle><AlertDialogDescription>{workflows.roundSubmitting || pendingMutations > 0 ? "A compliance submission is in progress. It must finish before you leave." : "Unsubmitted values on this screen will be discarded. Saved records and queued offline work will remain."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel autoFocus>Stay</AlertDialogCancel>{navigationRequest?.run && <AlertDialogAction disabled={workflows.roundSubmitting || pendingMutations > 0} onClick={event => { event.preventDefault(); if (workflows.roundSubmitting || pendingMutations > 0 || !navigationRequest?.run) return; const run = navigationRequest.run; setNavigationRequest(null); exitActiveWorkflow(); run(); }}>Leave</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
  const managerReviewStatus = useRestQuery<ManagerReviewStatus | null>(dashboard && dashboard.access?.role !== "staff" ? `manager-reviews-status:${dashboard.location._id}:${operationalDate}` : null, () => restApi.managerReviews.list({ locationId: dashboard!.location._id }), Boolean(dashboard && dashboard.access?.role !== "staff"));
  const additional = useRestQuery(dashboard ? `additional:${dashboard.location._id}:${operationalDate}` : null, () => restApi.additional.dashboard({ locationId: dashboard!.location._id }), Boolean(dashboard));
  const library = useRestQuery<{ documents: Array<{ id: string; title: string; description?: string | null; category: string; important: boolean; updatedAt?: string; documentUrl?: string | null }> }>(view === "library" && currentLocationId ? `library:${currentLocationId}` : null, () => restApi.library.list({ locationId: currentLocationId }), Boolean(view === "library" && currentLocationId));
  const calendarQuery = useRestQueryState<CalendarDay[]>(view === "calendar" && dashboard ? `calendar:${dashboard.location._id}:${bounds.start}:${bounds.end}:${operationalDate}` : null, () => restApi.compliance.calendar({ locationId: dashboard!.location._id, monthStart: bounds.start, monthEnd: bounds.end }), Boolean(view === "calendar" && dashboard));
  const archive = useRestQuery(view === "day" && dashboard && selectedDay ? `archive:${dashboard.location._id}:${selectedDay}` : null, () => restApi.compliance.archive({ locationId: dashboard!.location._id, start: selectedDay!, end: selectedDay! }), Boolean(view === "day" && dashboard && selectedDay));
  const workflows = useDashboardWorkflows({ dashboard, currentLocationId });

  const hasActiveWorkflow = Boolean(workflows.round || structuredTaskArea || workflows.cleaningList || workflows.checklistList || workflows.security || (view === "managerReviews" && managerReviewsDirty));

  function exitActiveWorkflow() {
    if (workflows.roundSubmitting) return;
    if (workflows.round || structuredTaskArea || workflows.cleaningList || workflows.checklistList || workflows.security) workflows.resetForLocation();
    setStructuredTaskArea(null);
    setRecordView(null);
    setManagerCleaningTaskId(undefined);
    setManagerAdditionalRequirementId(undefined);
    setWorkflowReturnView("today");
    if (managerReviewsDirty) setManagerReviewsDirty(false);
    if (adminHasUnsavedChanges) setAdminHasUnsavedChanges(false);
  }

  function navigationNeedsConfirmation() {
    return shouldConfirmAppNavigation({ activeWorkflow: hasActiveWorkflow, adminHasUnsavedChanges: view === "admin" && adminHasUnsavedChanges, submissionInFlight: workflows.roundSubmitting, pendingMutations });
  }

  function requestNavigation(run: () => void) {
    if (navigationNeedsConfirmation()) { setNavigationRequest({ run }); return; }
    run();
  }

  function navigateTo(destination: DashboardView) {
    if (destination === view && !workflows.round && !structuredTaskArea && !workflows.cleaningList && !workflows.checklistList && !workflows.security) return;
    requestNavigation(() => { exitActiveWorkflow(); setView(destination); });
  }

  function switchLocation(nextLocationId: string) {
    if (!nextLocationId || nextLocationId === currentLocationId) return;
    requestNavigation(() => {
      if (workflows.round || structuredTaskArea || workflows.cleaningList || workflows.checklistList || workflows.security) workflows.resetForLocation();
      clearOfflineSession();
      setLocationId(nextLocationId);
      setView("today");
      setStructuredTaskArea(null);
      setRecordView(null);
    });
  }

  function openManagementView() {
    if (!capabilities.canUseManagement) return;
    navigateTo("admin");
  }

  function openManagerReviews(targetLocationId?: string) {
    const destination = targetLocationId ?? currentLocationId;
    if (!destination || !getRoleCapabilities(user, memberships, destination).canViewManagerReviews) return;
    if (destination !== currentLocationId) {
      requestNavigation(() => { setManagerAllStores(false); setManagerReturnToAllStores(false); clearOfflineSession(); setLocationId(destination); setManagerSection("overview"); setView("managerReviews"); });
      return;
    }
    setManagerAllStores(false);
    setManagerReturnToAllStores(false);
    navigateTo("managerReviews");
  }

  function launchManagerTarget(target: ManagerOverviewTarget) {
    if (!capabilities.canViewManagerReviews) return;
    setWorkflowReturnView("managerReviews");
    setManagerReviewsDirty(false);
    if (target.kind === "required") {
      if (target.taskId === "am" || target.taskId === "pm") { void workflows.beginRound(target.taskId === "am" ? "AM" : "PM"); return; }
      if (target.taskId === "opening" || target.taskId === "closing") { workflows.setChecklistList(target.taskId); return; }
      const session = target.taskId === "security_am" ? "AM" : "PM";
      const area = target.taskId;
      const hasStructured = (workflows.active?.structuredTasks ?? []).some(task => task.area === area && (task.taskType === "with_steps" || task.completionMode === "task"));
      if (hasStructured) setStructuredTaskArea(area); else workflows.beginSecurity(session);
      return;
    }
    if (target.kind === "cleaning") {
      if (!(workflows.active?.structuredTasks ?? []).some(task => task._id === target.taskId && task.area === "cleaning")) { toast.error("This cleaning task is no longer available. Refresh the overview."); return; }
      setManagerCleaningTaskId(target.taskId); workflows.setCleaningList(true); return;
    }
    if (target.kind === "additional") {
      if (!(additional?.requirements ?? []).some((item: { _id: string }) => item._id === target.requirementId)) { toast.error("This additional check is no longer available. Refresh the overview."); return; }
      setManagerAdditionalRequirementId(target.requirementId); setView("additional"); return;
    }
    setManagerSection("reviews");
    window.setTimeout(() => document.getElementById(target.reviewType === "weekly" ? "weekly-review" : "four-week-review")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function openManagerTarget(targetLocationId: string, target: ManagerOverviewTarget) {
    if (!locations?.some(location => location._id === targetLocationId && getRoleCapabilities(user, memberships, targetLocationId).canViewManagerReviews)) return;
    requestNavigation(() => {
      setManagerReviewsDirty(false);
      setWorkflowReturnView("managerReviews");
      if (targetLocationId !== currentLocationId) {
        clearOfflineSession();
        setLocationId(targetLocationId);
        setManagerSection("overview");
        setPendingManagerTarget({ locationId: targetLocationId, target });
      } else launchManagerTarget(target);
    });
  }

  function changeManagerStore(nextLocationId: string) {
    if (!locations?.some(location => location._id === nextLocationId && getRoleCapabilities(user, memberships, nextLocationId).canViewManagerReviews)) return;
    if (nextLocationId === currentLocationId) return;
    clearOfflineSession();
    setManagerAllStores(false);
    setManagerReturnToAllStores(false);
    setLocationId(nextLocationId);
    setView("managerReviews");
    setManagerSection("overview");
  }

  function openManagerStoreFromAllStores(nextLocationId: string) {
    if (!locations?.some(location => location._id === nextLocationId && getRoleCapabilities(user, memberships, nextLocationId).canViewManagerReviews)) return;
    requestNavigation(() => {
      allStoresOriginLocationId.current = currentLocationId;
      setManagerReturnToAllStores(true);
      setManagerAllStores(false);
      setManagerReviewsDirty(false);
      clearOfflineSession();
      setLocationId(nextLocationId);
      setManagerSection("overview");
      setView("managerReviews");
    });
  }

  function returnToAllStores() {
    requestNavigation(() => {
      // If the opened store failed to load, fall back to the store All stores was opened from.
      if (dashboard === null && allStoresOriginLocationId.current) setLocationId(allStoresOriginLocationId.current);
      setView("managerReviews");
      setManagerSection("overview");
      setManagerReturnToAllStores(false);
      setManagerAllStores(true);
    });
  }

  useEffect(() => {
    if (pendingManagerTarget && dashboard?.location._id === pendingManagerTarget.locationId && (pendingManagerTarget.target.kind !== "additional" || additional !== undefined)) {
      const { target } = pendingManagerTarget;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPendingManagerTarget(null);
      launchManagerTarget(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingManagerTarget, dashboard?.location._id, additional]);

  const viewTemperatureRecords = (session: "AM" | "PM") => setRecordView({ kind: "temperature", session });
  const viewChecklistRecords = (checklist: "opening" | "closing") => setRecordView({ kind: "checklist", checklist });
  const viewSecurityRecords = (session: "AM" | "PM") => setRecordView({ kind: "security", session });
  const viewCleaningRecords = () => setRecordView({ kind: "cleaning" });
  const viewProbeRecords = () => setRecordView({ kind: "probes" });
  const viewWastageRecords = () => setRecordView({ kind: "wastage" });
  const addProbeFromRecords = () => {
    setRecordView(null);
    workflows.setProbeProduct(workflows.active?.probeProducts[0]?.name ?? "");
    workflows.setProbeFailed(false);
    workflows.setProbeIssueId(null);
    workflows.setProbeQuantity("");
    workflows.setProbeOpen(true);
  };
  const addWastageFromRecords = () => {
    setRecordView(null);
    workflows.openWastage();
  };

  // Mirror top-level navigation into browser history so Back/Forward (and the Android back
  // gesture) move between screens and stores instead of leaving the app.
  useEffect(() => {
    if (!currentLocationId) return;
    const nav: AppHistoryState = { view, locationId: currentLocationId, allStores: managerAllStores, returnToAllStores: managerReturnToAllStores };
    const existing = (window.history.state as { leFeastNav?: AppHistoryState } | null)?.leFeastNav;
    if (existing && sameHistoryState(existing, nav)) return;
    const state = { ...(window.history.state ?? {}), leFeastNav: nav };
    if (existing) window.history.pushState(state, "");
    else window.history.replaceState(state, "");
  }, [view, currentLocationId, managerAllStores, managerReturnToAllStores]);
  const applyHistoryStateRef = useRef<(nav: AppHistoryState) => void>(() => {});
  useEffect(() => {
  applyHistoryStateRef.current = (nav: AppHistoryState) => {
    const apply = () => {
      exitActiveWorkflow();
      if (nav.locationId !== currentLocationId) clearOfflineSession();
      setLocationId(nav.locationId);
      setView(nav.view);
      setManagerAllStores(nav.allStores);
      setManagerReturnToAllStores(nav.returnToAllStores);
      setRecordView(null);
    };
    if (!navigationNeedsConfirmation() || !currentLocationId) { apply(); return; }
    // The browser has already moved back; put the current screen's entry back until the
    // user confirms leaving unsaved work.
    const current: AppHistoryState = { view, locationId: currentLocationId, allStores: managerAllStores, returnToAllStores: managerReturnToAllStores };
    window.history.pushState({ ...(window.history.state ?? {}), leFeastNav: current }, "");
    setNavigationRequest({ run: apply });
  };
  });
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const nav = (event.state as { leFeastNav?: AppHistoryState } | null)?.leFeastNav;
      if (nav) applyHistoryStateRef.current(nav);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  if (view === "managerReviews" && !recordView && !workflows.round && !structuredTaskArea && !workflows.cleaningList && !workflows.checklistList && !workflows.security) return capabilities.canViewManagerReviews
    ? appShell(<ManagerReviews key={currentLocationId ?? "manager-overview"} locationId={currentLocationId ?? ""} locations={(locations ?? []).filter(location => getRoleCapabilities(user, memberships, location._id).canViewManagerReviews)} onBack={() => navigateTo("today")} onOpenTask={openManagerTarget} onStoreChange={changeManagerStore} onRequestNavigation={requestNavigation} activeSection={managerSection} onActiveSectionChange={setManagerSection} onDirtyChange={setManagerReviewsDirty} allStores={managerAllStores} returnToAllStores={managerReturnToAllStores} onAllStoresChange={setManagerAllStores} onSelectAllStore={openManagerStoreFromAllStores} onReturnToAllStores={returnToAllStores} />)
    : appShell(<AccessDenied />);
  if (dashboard === undefined) return <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="rounded-2xl border border-black/[0.07] bg-white px-6 py-5 text-center"><p className="font-semibold">Loading today&apos;s checks…</p><p className="mt-1 text-sm text-[#727a74]">Connecting to your Le Feast store.</p></div></div>;
  if (dashboard === null && !storeAccessDenied) return <div className="flex min-h-screen items-center justify-center bg-white p-6"><div role="alert" className="max-w-md rounded-2xl border border-[#efc8c3] bg-white p-6 text-center"><p className="font-semibold text-[#202522]">This store couldn&apos;t be loaded</p><p className="mt-2 text-sm text-[#727a74]">Check your connection and try again. Your access has not changed.</p><div className="mt-4 flex flex-wrap justify-center gap-2"><button type="button" onClick={() => window.dispatchEvent(new Event("rest:data-changed"))} className="min-h-11 rounded-xl bg-[#202522] px-4 text-sm font-semibold text-white">Try again</button>{managerReturnToAllStores && <button type="button" onClick={returnToAllStores} className="min-h-11 rounded-xl border border-black/[0.1] px-4 text-sm font-semibold text-[#202522]">Back to all stores</button>}</div></div></div>;
  if (dashboard === null) return <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="max-w-md rounded-2xl border border-[#efc8c3] bg-white p-6 text-center"><p className="font-semibold text-[#202522]">Store access required</p><p className="mt-2 text-sm text-[#727a74]">Your account does not currently have access to a Le Feast store. Please contact an administrator.</p></div></div>;
  if (view === "managerReviews" && dashboard.location._id !== currentLocationId) return appShell(<div role="status" className="mx-auto max-w-3xl p-6 text-sm text-[#606861]">Loading selected store overview…</div>);

  if (recordView) return appShell(<OperationalRecordsView {...recordView} dashboard={dashboard} onBack={() => setRecordView(null)} onAdd={recordView.kind === "probes" ? addProbeFromRecords : recordView.kind === "wastage" ? addWastageFromRecords : undefined} />);
  if (workflows.round && workflows.roundIssues.length) return appShell(<TemperatureActionScreen session={workflows.round} issues={workflows.roundIssues} teamMembers={dashboard.teamMembers} issueProgress={workflows.issueProgress} setIssueProgress={workflows.setIssueProgress} roundTeamMemberId={workflows.roundCompleterId} setRoundCompleterId={workflows.setRoundCompleterId} submitting={workflows.roundSubmitting} onSaveActions={workflows.saveTemperatureActions} onCompleteRound={workflows.completeRecoveredTemperatureRound} onBack={() => navigateTo(workflowReturnView)} />);
  if (workflows.round) return appShell(<TemperatureRoundEntry session={workflows.round} equipment={workflows.roundEquipment} savedReadings={workflows.roundReadings} teamMembers={dashboard.teamMembers} memberId={workflows.roundCompleterId} setMemberId={workflows.setRoundCompleterId} temperatures={workflows.temperatures} setTemperatures={workflows.setTemperatures} submitting={workflows.roundSubmitting} onComplete={workflows.completeTemperatureRound} onBack={() => navigateTo(workflowReturnView)} />);
  if (structuredTaskArea) return appShell(<StructuredTaskWorkflow key={`${dashboard.location._id}:${structuredTaskArea}`} locationId={dashboard.location._id} locationName={dashboard.location.name} area={structuredTaskArea} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === structuredTaskArea)} responses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} signOffRecorded={structuredTaskArea === "opening" || structuredTaskArea === "closing" ? Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === structuredTaskArea)) : Boolean(dashboard.securitySignOffs?.some(signOff => signOff.session === (structuredTaskArea === "security_am" ? "AM" : "PM")))} onBack={() => navigateTo(workflowReturnView)} />);
  if (workflows.cleaningList) return appShell(<InlineCleaning key={dashboard.location._id} initialTaskId={managerCleaningTaskId} locationId={dashboard.location._id} locationName={dashboard.location.name} tasks={(workflows.active?.structuredTasks ?? []).filter((task) => task.area === "cleaning")} responses={workflows.active?.structuredTaskResponses ?? []} completions={workflows.active?.cleaningCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeCleaning} onIssue={workflows.reportCleaningIssue} onBack={() => navigateTo(workflowReturnView)} />);
  if (workflows.checklistList) return appShell(<InlineChecklist key={`${dashboard.location._id}:${workflows.checklistList}`} locationId={dashboard.location._id} checklist={workflows.checklistList} title={workflows.checklistList === "opening" ? "Opening checklist" : "Closing checklist"} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === workflows.checklistList)} legacyResponses={workflows.active?.checklists[workflows.checklistList].responses ?? []} structuredResponses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} onSignOff={workflows.signOffChecklistTask} signOffRecorded={Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === workflows.checklistList))} onBack={() => navigateTo(workflowReturnView)} />);
  if (workflows.security && workflows.currentSecurityQuestion) return appShell(<SecurityScreen locationId={dashboard.location._id} session={workflows.security} question={workflows.currentSecurityQuestion.question} index={workflows.securityIndex} total={workflows.active?.security[workflows.security].length ?? 0} teamMembers={dashboard.teamMembers} teamMemberId={workflows.securityTeamMemberId} setTeamMemberId={workflows.setSecurityTeamMemberId} issue={workflows.securityIssue} setIssue={workflows.setSecurityIssue} onSave={workflows.saveSecurity} onBack={() => navigateTo(workflowReturnView)} />);
  if (view === "day") return appShell(<MobileDayView location={dashboard.location} date={selectedDay ?? formatDateKey(new Date())} archive={archive} equipment={workflows.equipment} onBack={() => navigateTo("calendar")} />);
  if (view === "additional") return appShell(<AdditionalChecksView initialRequirementId={managerAdditionalRequirementId} locationId={dashboard.location._id} locationName={dashboard.location.name} requirements={additional?.requirements ?? []} completions={additional?.completions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeAdditional} onBack={() => navigateTo(workflowReturnView)} />);

  const todayProps: DashboardTodayProps = {
    ...workflows,
    dashboard,
    active: workflows.active!,
    onManagerReviews: () => openManagerReviews(),
    canUseManagement: capabilities.canUseManagement,
    managerReviewStatus,
    renderTimestamp,
    viewTemperatureRecords,
    viewChecklistRecords,
    viewSecurityRecords,
    viewCleaningRecords,
    viewProbeRecords,
    viewWastageRecords,
    setView: (next: SetStateAction<DashboardView>) => navigateTo(typeof next === "function" ? next(view) : next),
    additional,
    structuredTasks: workflows.active?.structuredTasks ?? [],
    onOpenStructuredTask: setStructuredTaskArea,
  };
  const mainView = view === "calendar"
    ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} days={calendarQuery.data ?? []} loading={calendarQuery.loading} error={calendarQuery.error?.message ?? null} onRetry={calendarQuery.retry} onBack={() => navigateTo("today")} onDay={(date: string) => requestNavigation(() => { setSelectedDay(date); setView("day"); })} />
    : view === "training"
        ? <TrainingView locationName={dashboard.location.name} requirements={workflows.active?.trainingRequirements ?? []} completions={workflows.active?.trainingCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeTraining} onBack={() => navigateTo("library")} />
      : view === "library"
        ? <LibraryView locationName={dashboard.location.name} documents={library?.documents ?? []} onBack={() => navigateTo("today")} onOpenTraining={() => navigateTo("training")} />
        : view === "admin"
          ? capabilities.canUseManagement
            ? <AdminSetup onBack={() => navigateTo("today")} onManagerReviews={openManagerReviews} onDirtyChange={setAdminHasUnsavedChanges} onOpenDay={(date, reportLocationId) => requestNavigation(() => { if (reportLocationId !== currentLocationId) { clearOfflineSession(); setLocationId(reportLocationId); workflows.resetForLocation(); } setSelectedDay(date); setView("day"); })} />
            : <AccessDenied />
          : <DashboardToday {...todayProps} />;
  return appShell(mainView);
}
