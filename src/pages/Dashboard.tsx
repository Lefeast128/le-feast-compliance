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
import type { CalendarDay, DashboardData, DashboardLocation, DashboardView, ManagerReviewStatus } from "@/components/dashboard/dashboard-types";
import { useAuth } from "@/hooks/use-auth";
import { restApi, useRestQuery } from "@/lib/rest-domain";
import { getInFlightMutationCount } from "@/lib/api-client";
import { formatDateKey } from "@/lib/date-key";
import { getRoleCapabilities } from "@/lib/role-capabilities";
import { clearOfflineSession, establishOfflineSession, readOfflineSession } from "@/lib/offline/device-session";
import { readOpeningSnapshot, writeOpeningSnapshot } from "@/lib/offline/dashboard-snapshot";
import { useState } from "react";
import { useEffect } from "react";
import type { ReactNode, SetStateAction } from "react";
import ShiftHandoverPanel, { type HandoverData } from "@/components/ShiftHandoverPanel";
import ProfileMenu from "@/components/dashboard/ProfileMenu";
import logo from "@/assets/logo.svg";
import MarkdownSheetPanel from "@/components/MarkdownSheetPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const monthBounds = (value: Date) => ({ start: formatDateKey(new Date(value.getFullYear(), value.getMonth(), 1)), end: formatDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0)) });
const localDateKey = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find(part => part.type === "year")?.value}-${parts.find(part => part.type === "month")?.value}-${parts.find(part => part.type === "day")?.value}`;
};
const AccessDenied = () => <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="rounded-2xl border border-[#efc8c3] bg-white px-6 py-5 text-center"><p className="font-semibold">Management access required</p><p className="mt-1 text-sm text-[#727a74]">This area is only available to managers for their assigned stores.</p></div></div>;

export default function Dashboard() {
  const { logout, user, memberships } = useAuth();
  const [renderTimestamp] = useState(() => Date.now());
  const [locationId, setLocationId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("today");
  const [navigationRequest, setNavigationRequest] = useState<{ run: (() => void) | null } | null>(null);
  const [pendingMutations, setPendingMutations] = useState(getInFlightMutationCount);
  const [structuredTaskArea, setStructuredTaskArea] = useState<"opening" | "closing" | "cleaning" | "security_am" | "security_pm" | null>(null);
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
  const onlineDashboard = useRestQuery<DashboardData | null>(currentLocationId ? `dashboard:${currentLocationId}` : null, () => restApi.compliance.dashboard({ locationId: currentLocationId }), Boolean(currentLocationId));
  const [offlineDashboard, setOfflineDashboard] = useState<DashboardData | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfflineDashboard(currentLocationId ? readOpeningSnapshot(currentLocationId) : null);
  }, [currentLocationId]);
  useEffect(() => {
    if (onlineDashboard && user?.organisationId && currentLocationId) {
      establishOfflineSession(user, currentLocationId, memberships);
      writeOpeningSnapshot(onlineDashboard);
    }
  }, [currentLocationId, memberships, onlineDashboard, user]);
  const dashboard = onlineDashboard ?? offlineDashboard;
  const handover = useRestQuery<HandoverData | null>(currentLocationId ? `handover:${currentLocationId}` : null, () => restApi.compliance.handover.list({ locationId: currentLocationId! }), Boolean(currentLocationId));
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverMorningPrompt, setHandoverMorningPrompt] = useState<number | null>(null);
  const handoverTimezone = dashboard?.location.timezone ?? locations?.find(location => location._id === currentLocationId)?.timezone ?? "Europe/London";
  /* eslint-disable react-hooks/set-state-in-effect -- prompt state mirrors localStorage and server unread state. */
  useEffect(() => {
    if (!handover?.unreadCount || !user?.id || !currentLocationId) { setHandoverMorningPrompt(null); return; }
    const key = `mise.handover.morning:${user.id}:${currentLocationId}:${localDateKey(handoverTimezone)}`;
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
    if (user?.id && currentLocationId) window.localStorage.setItem(`mise.handover.morning:${user.id}:${currentLocationId}:${localDateKey(handoverTimezone)}`, "1");
    setHandoverMorningPrompt(null);
    if (action === "view") setHandoverOpen(true);
  };
  const refreshHandover = () => window.dispatchEvent(new Event("rest:data-changed"));
  const activeNavigation = view === "training" || view === "library" ? "library" : view === "calendar" || view === "day" ? "calendar" : view === "admin" || (view === "managerReviews" && capabilities.canUseManagement) ? "admin" : "today";
  const appShell = (content: ReactNode) => <div className="min-h-screen bg-white pb-[calc(6.5rem+env(safe-area-inset-bottom))]"><header className="print:hidden"><div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-4"><div className="flex min-w-0 items-center gap-2"><img src={logo} alt="mise." width={32} height={32} className="size-8 shrink-0 rounded-lg" /><div className="min-w-0 leading-none"><p className="truncate text-[15px] font-bold tracking-tight text-[#202522]">mise.</p><p className="mt-1 text-[9px] font-medium tracking-wide text-[#727a74]">by Le Feast</p></div></div><div className="flex items-center gap-1"><ShiftHandoverPanel locationId={currentLocationId ?? dashboard?.location._id ?? ""} data={handover ?? undefined} userId={user?.id} teamMembers={dashboard?.teamMembers ?? []} canModerate={capabilities.canViewManagerReviews} open={handoverOpen} onOpenChange={setHandoverOpen} onRefresh={refreshHandover} morningPrompt={handoverMorningPrompt} onMorningPromptAction={handleMorningPromptAction} /><MarkdownSheetPanel locationId={currentLocationId ?? dashboard?.location._id ?? ""} locationName={dashboard?.location.name ?? "Store"} timeZone={handoverTimezone} teamMembers={dashboard?.teamMembers ?? []} canManageProducts={capabilities.canUseManagement} /><ProfileMenu user={user!} memberships={memberships} locations={locations ?? []} currentLocationId={currentLocationId} onLocationChange={switchLocation} onManagerReviews={openManagerReviews} onAdmin={openManagementView} onLogout={logout} /></div></div></header>{content}<BottomNavigation onToday={() => navigateTo("today")} onLibrary={() => navigateTo("library")} onCalendar={() => navigateTo("calendar")} onAdmin={openManagementView} canUseManagement={capabilities.canUseManagement} active={activeNavigation} /><AlertDialog open={Boolean(navigationRequest)} onOpenChange={open => { if (!open) setNavigationRequest(null); }}><AlertDialogContent className="z-[60]"><AlertDialogHeader><AlertDialogTitle>{workflows.roundSubmitting || pendingMutations > 0 ? "Please wait" : "Leave this screen?"}</AlertDialogTitle><AlertDialogDescription>{workflows.roundSubmitting || pendingMutations > 0 ? "A compliance submission is in progress. It must finish before you leave." : "Unsubmitted values on this screen will be discarded. Saved records and queued offline work will remain."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel autoFocus>Stay</AlertDialogCancel>{navigationRequest?.run && <AlertDialogAction disabled={workflows.roundSubmitting || pendingMutations > 0} onClick={event => { event.preventDefault(); if (workflows.roundSubmitting || pendingMutations > 0 || !navigationRequest?.run) return; const run = navigationRequest.run; setNavigationRequest(null); exitActiveWorkflow(); run(); }}>Leave</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
  const managerReviewStatus = useRestQuery<ManagerReviewStatus | null>(dashboard && dashboard.access?.role !== "staff" ? `manager-reviews-status:${dashboard.location._id}` : null, () => restApi.managerReviews.list({ locationId: dashboard!.location._id }), Boolean(dashboard && dashboard.access?.role !== "staff"));
  const additional = useRestQuery(dashboard ? `additional:${dashboard.location._id}` : null, () => restApi.additional.dashboard({ locationId: dashboard!.location._id }), Boolean(dashboard));
  const library = useRestQuery<{ documents: Array<{ id: string; title: string; description?: string | null; category: string; important: boolean; updatedAt?: string; documentUrl?: string | null }> }>(view === "library" && currentLocationId ? `library:${currentLocationId}` : null, () => restApi.library.list({ locationId: currentLocationId }), Boolean(view === "library" && currentLocationId));
  const calendar = useRestQuery<CalendarDay[]>(view === "calendar" && dashboard ? `calendar:${dashboard.location._id}:${bounds.start}:${bounds.end}` : null, () => restApi.compliance.calendar({ locationId: dashboard!.location._id, monthStart: bounds.start, monthEnd: bounds.end }), Boolean(view === "calendar" && dashboard));
  const archive = useRestQuery(view === "day" && dashboard && selectedDay ? `archive:${dashboard.location._id}:${selectedDay}` : null, () => restApi.compliance.archive({ locationId: dashboard!.location._id, start: selectedDay!, end: selectedDay! }), Boolean(view === "day" && dashboard && selectedDay));
  const workflows = useDashboardWorkflows({ dashboard, currentLocationId });

  const hasActiveWorkflow = Boolean(workflows.round || structuredTaskArea || workflows.cleaningList || workflows.checklistList || workflows.security || view === "admin");

  function exitActiveWorkflow() {
    if (workflows.roundSubmitting) return;
    if (workflows.round || structuredTaskArea || workflows.cleaningList || workflows.checklistList || workflows.security) workflows.resetForLocation();
    setStructuredTaskArea(null);
    setRecordView(null);
  }

  function requestNavigation(run: () => void) {
    if (workflows.roundSubmitting || pendingMutations > 0) { setNavigationRequest({ run }); return; }
    if (hasActiveWorkflow) { setNavigationRequest({ run }); return; }
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

  function openManagerReviews() {
    if (!capabilities.canViewManagerReviews) return;
    navigateTo("managerReviews");
  }

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

  if (dashboard === undefined) return <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="rounded-2xl border border-black/[0.07] bg-white px-6 py-5 text-center"><p className="font-semibold">Loading today&apos;s checks…</p><p className="mt-1 text-sm text-[#727a74]">Connecting to your Le Feast store.</p></div></div>;
  if (dashboard === null) return <div className="flex min-h-screen items-center justify-center bg-white p-6"><div className="max-w-md rounded-2xl border border-[#efc8c3] bg-white p-6 text-center"><p className="font-semibold text-[#202522]">Store access required</p><p className="mt-2 text-sm text-[#727a74]">Your account does not currently have access to a Le Feast store. Please contact an administrator.</p></div></div>;

  if (recordView) return appShell(<OperationalRecordsView {...recordView} dashboard={dashboard} onBack={() => setRecordView(null)} onAdd={recordView.kind === "probes" ? addProbeFromRecords : recordView.kind === "wastage" ? addWastageFromRecords : undefined} />);
  if (workflows.round && workflows.roundIssues.length) return appShell(<TemperatureActionScreen session={workflows.round} issues={workflows.roundIssues} teamMembers={dashboard.teamMembers} issueProgress={workflows.issueProgress} setIssueProgress={workflows.setIssueProgress} roundTeamMemberId={workflows.roundCompleterId} setRoundCompleterId={workflows.setRoundCompleterId} submitting={workflows.roundSubmitting} onSaveActions={workflows.saveTemperatureActions} onCompleteRound={workflows.completeRecoveredTemperatureRound} onBack={() => navigateTo("today")} />);
  if (workflows.round) return appShell(<TemperatureRoundEntry session={workflows.round} equipment={workflows.roundEquipment} savedReadings={workflows.roundReadings} teamMembers={dashboard.teamMembers} memberId={workflows.roundCompleterId} setMemberId={workflows.setRoundCompleterId} temperatures={workflows.temperatures} setTemperatures={workflows.setTemperatures} submitting={workflows.roundSubmitting} onComplete={workflows.completeTemperatureRound} onBack={() => navigateTo("today")} />);
  if (structuredTaskArea) return appShell(<StructuredTaskWorkflow key={`${dashboard.location._id}:${structuredTaskArea}`} locationId={dashboard.location._id} locationName={dashboard.location.name} area={structuredTaskArea} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === structuredTaskArea)} responses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} signOffRecorded={structuredTaskArea === "opening" || structuredTaskArea === "closing" ? Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === structuredTaskArea)) : Boolean(dashboard.securitySignOffs?.some(signOff => signOff.session === (structuredTaskArea === "security_am" ? "AM" : "PM")))} onBack={() => navigateTo("today")} />);
  if (workflows.cleaningList) return appShell(<InlineCleaning key={dashboard.location._id} locationId={dashboard.location._id} locationName={dashboard.location.name} tasks={(workflows.active?.structuredTasks ?? []).filter((task) => task.area === "cleaning")} responses={workflows.active?.structuredTaskResponses ?? []} completions={workflows.active?.cleaningCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeCleaning} onIssue={workflows.reportCleaningIssue} onBack={() => navigateTo("today")} />);
  if (workflows.checklistList) return appShell(<InlineChecklist key={`${dashboard.location._id}:${workflows.checklistList}`} locationId={dashboard.location._id} checklist={workflows.checklistList} title={workflows.checklistList === "opening" ? "Opening checklist" : "Closing checklist"} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === workflows.checklistList)} legacyResponses={workflows.active?.checklists[workflows.checklistList].responses ?? []} structuredResponses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} onSignOff={workflows.signOffChecklistTask} signOffRecorded={Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === workflows.checklistList))} onBack={() => navigateTo("today")} />);
  if (workflows.security && workflows.currentSecurityQuestion) return appShell(<SecurityScreen locationId={dashboard.location._id} session={workflows.security} question={workflows.currentSecurityQuestion.question} index={workflows.securityIndex} total={workflows.active?.security[workflows.security].length ?? 0} teamMembers={dashboard.teamMembers} teamMemberId={workflows.securityTeamMemberId} setTeamMemberId={workflows.setSecurityTeamMemberId} issue={workflows.securityIssue} setIssue={workflows.setSecurityIssue} onSave={workflows.saveSecurity} onBack={() => navigateTo("today")} />);
  if (view === "day") return appShell(<MobileDayView location={dashboard.location} date={selectedDay ?? formatDateKey(new Date())} archive={archive} equipment={workflows.equipment} onBack={() => navigateTo("calendar")} />);
  if (view === "additional") return appShell(<AdditionalChecksView locationId={dashboard.location._id} locationName={dashboard.location.name} requirements={additional?.requirements ?? []} completions={additional?.completions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeAdditional} onBack={() => navigateTo("today")} />);
  if (view === "managerReviews") return capabilities.canViewManagerReviews
    ? appShell(<ManagerReviews locationId={dashboard.location._id} locations={locations ?? [dashboard.location]} onBack={() => navigateTo("today")} onOpenDailyChecks={(selectedLocationId) => { if (selectedLocationId !== currentLocationId) switchLocation(selectedLocationId); else navigateTo("today"); }} />)
    : appShell(<AccessDenied />);

  const todayProps: DashboardTodayProps = {
    ...workflows,
    dashboard,
    active: workflows.active!,
    onManagerReviews: openManagerReviews,
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
    ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} days={calendar ?? []} onBack={() => navigateTo("today")} onDay={(date: string) => requestNavigation(() => { setSelectedDay(date); setView("day"); })} />
    : view === "training"
        ? <TrainingView locationName={dashboard.location.name} requirements={workflows.active?.trainingRequirements ?? []} completions={workflows.active?.trainingCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeTraining} onBack={() => navigateTo("library")} />
      : view === "library"
        ? <LibraryView locationName={dashboard.location.name} documents={library?.documents ?? []} onBack={() => navigateTo("today")} onOpenTraining={() => navigateTo("training")} />
        : view === "admin"
          ? capabilities.canUseManagement
            ? <AdminSetup onBack={() => navigateTo("today")} onOpenDay={(date, reportLocationId) => requestNavigation(() => { if (reportLocationId !== currentLocationId) { clearOfflineSession(); setLocationId(reportLocationId); workflows.resetForLocation(); } setSelectedDay(date); setView("day"); })} />
            : <AccessDenied />
          : <DashboardToday {...todayProps} />;
  return appShell(mainView);
}
