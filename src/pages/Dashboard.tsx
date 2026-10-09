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
import { formatDateKey } from "@/lib/date-key";
import { getRoleCapabilities } from "@/lib/role-capabilities";
import { useState } from "react";

const dateLabel = (value = new Date()) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value);
const monthBounds = (value: Date) => ({ start: formatDateKey(new Date(value.getFullYear(), value.getMonth(), 1)), end: formatDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0)) });
const AccessDenied = () => <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5] p-6"><div className="rounded-2xl border border-[#efc8c3] bg-white px-6 py-5 text-center"><p className="font-semibold">Management access required</p><p className="mt-1 text-sm text-[#727a74]">This area is only available to managers for their assigned stores.</p></div></div>;

export default function Dashboard() {
  const { logout, user, memberships } = useAuth();
  const [renderTimestamp] = useState(() => Date.now());
  const [locationId, setLocationId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("today");
  const [structuredTaskArea, setStructuredTaskArea] = useState<"opening" | "closing" | "cleaning" | "security_am" | "security_pm" | null>(null);
  const [recordView, setRecordView] = useState<{ kind: "temperature" | "checklist" | "security" | "cleaning" | "probes" | "wastage"; session?: "AM" | "PM"; checklist?: "opening" | "closing" } | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const bounds = monthBounds(calendarMonth);
  const locations = useRestQuery<DashboardLocation[]>("locations", restApi.locations.myLocations, true);
  const currentLocationId = locationId ?? locations?.[0]?._id ?? null;
  const capabilities = getRoleCapabilities(user, memberships, currentLocationId);
  const dashboard = useRestQuery<DashboardData | null>(currentLocationId ? `dashboard:${currentLocationId}` : null, () => restApi.compliance.dashboard({ locationId: currentLocationId }), Boolean(currentLocationId));
  const managerReviewStatus = useRestQuery<ManagerReviewStatus | null>(dashboard && dashboard.access?.role !== "staff" ? `manager-reviews-status:${dashboard.location._id}` : null, () => restApi.managerReviews.list({ locationId: dashboard!.location._id }), Boolean(dashboard && dashboard.access?.role !== "staff"));
  const additional = useRestQuery(dashboard ? `additional:${dashboard.location._id}` : null, () => restApi.additional.dashboard({ locationId: dashboard!.location._id }), Boolean(dashboard));
  const library = useRestQuery<{ documents: Array<{ id: string; title: string; description?: string | null; category: string; important: boolean; updatedAt?: string; documentUrl?: string | null }> }>(view === "library" && currentLocationId ? `library:${currentLocationId}` : null, () => restApi.library.list({ locationId: currentLocationId }), Boolean(view === "library" && currentLocationId));
  const calendar = useRestQuery<CalendarDay[]>(view === "calendar" && dashboard ? `calendar:${dashboard.location._id}:${bounds.start}:${bounds.end}` : null, () => restApi.compliance.calendar({ locationId: dashboard!.location._id, monthStart: bounds.start, monthEnd: bounds.end }), Boolean(view === "calendar" && dashboard));
  const archive = useRestQuery(view === "day" && dashboard && selectedDay ? `archive:${dashboard.location._id}:${selectedDay}` : null, () => restApi.compliance.archive({ locationId: dashboard!.location._id, start: selectedDay!, end: selectedDay! }), Boolean(view === "day" && dashboard && selectedDay));
  const workflows = useDashboardWorkflows({ dashboard, currentLocationId });

  function switchLocation(nextLocationId: string) {
    if (!nextLocationId || nextLocationId === currentLocationId) return;
    setLocationId(nextLocationId);
    setView("today");
    workflows.resetForLocation();
    setStructuredTaskArea(null);
    setRecordView(null);
  }

  function openManagementView() {
    if (!capabilities.canUseManagement) return;
    setView("admin");
  }

  function openManagerReviews() {
    if (!capabilities.canViewManagerReviews) return;
    setView("managerReviews");
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

  if (dashboard === undefined) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5] p-6"><div className="rounded-2xl border border-black/[0.07] bg-white px-6 py-5 text-center"><p className="font-semibold">Loading today&apos;s checks…</p><p className="mt-1 text-sm text-[#727a74]">Connecting to your Le Feast store.</p></div></div>;
  if (dashboard === null) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5] p-6"><div className="max-w-md rounded-2xl border border-[#efc8c3] bg-white p-6 text-center"><p className="font-semibold text-[#202522]">Store access required</p><p className="mt-2 text-sm text-[#727a74]">Your account does not currently have access to a Le Feast store. Please contact an administrator.</p></div></div>;

  if (recordView) return <OperationalRecordsView {...recordView} dashboard={dashboard} onBack={() => setRecordView(null)} onAdd={recordView.kind === "probes" ? addProbeFromRecords : recordView.kind === "wastage" ? addWastageFromRecords : undefined} />;
  if (workflows.round && workflows.roundIssues.length) return <TemperatureActionScreen session={workflows.round} issues={workflows.roundIssues} teamMembers={dashboard.teamMembers} issueProgress={workflows.issueProgress} setIssueProgress={workflows.setIssueProgress} roundCompleterId={workflows.roundCompleterId} setRoundCompleterId={workflows.setRoundCompleterId} submitting={workflows.roundSubmitting} onSaveActions={workflows.saveTemperatureActions} onCompleteRound={workflows.completeRecoveredTemperatureRound} onBack={() => { workflows.resetForLocation(); }} />;
  if (workflows.round) return <TemperatureRoundEntry session={workflows.round} equipment={workflows.roundEquipment} savedReadings={workflows.roundReadings} teamMembers={dashboard.teamMembers} temperatures={workflows.temperatures} setTemperatures={workflows.setTemperatures} submitting={workflows.roundSubmitting} onComplete={workflows.completeTemperatureRound} onBack={() => workflows.resetForLocation()} />;
  if (structuredTaskArea) return <StructuredTaskWorkflow key={`${dashboard.location._id}:${structuredTaskArea}`} locationId={dashboard.location._id} locationName={dashboard.location.name} area={structuredTaskArea} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === structuredTaskArea)} responses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} signOffRecorded={structuredTaskArea === "opening" || structuredTaskArea === "closing" ? Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === structuredTaskArea)) : Boolean(dashboard.securitySignOffs?.some(signOff => signOff.session === (structuredTaskArea === "security_am" ? "AM" : "PM")))} onBack={() => setStructuredTaskArea(null)} />;
  if (workflows.cleaningList) return <InlineCleaning key={dashboard.location._id} locationId={dashboard.location._id} locationName={dashboard.location.name} tasks={(workflows.active?.structuredTasks ?? []).filter((task) => task.area === "cleaning")} responses={workflows.active?.structuredTaskResponses ?? []} completions={workflows.active?.cleaningCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeCleaning} onIssue={workflows.reportCleaningIssue} onBack={() => workflows.setCleaningList(false)} />;
  if (workflows.checklistList) return <InlineChecklist key={`${dashboard.location._id}:${workflows.checklistList}`} locationId={dashboard.location._id} checklist={workflows.checklistList} title={workflows.checklistList === "opening" ? "Opening checklist" : "Closing checklist"} tasks={(workflows.active?.structuredTasks ?? []).filter(task => task.area === workflows.checklistList)} legacyResponses={workflows.active?.checklists[workflows.checklistList].responses ?? []} structuredResponses={workflows.active?.structuredTaskResponses ?? []} teamMembers={dashboard.teamMembers} onSignOff={workflows.signOffChecklistTask} signOffRecorded={Boolean(dashboard.checklistSignOffs?.some(signOff => signOff.checklist === workflows.checklistList))} onBack={() => workflows.setChecklistList(null)} />;
  if (workflows.security && workflows.currentSecurityQuestion) return <SecurityScreen session={workflows.security} question={workflows.currentSecurityQuestion.question} index={workflows.securityIndex} total={workflows.active?.security[workflows.security].length ?? 0} teamMembers={dashboard.teamMembers} teamMemberId={workflows.securityTeamMemberId} setTeamMemberId={workflows.setSecurityTeamMemberId} issue={workflows.securityIssue} setIssue={workflows.setSecurityIssue} onSave={workflows.saveSecurity} onBack={() => { workflows.setSecurity(null); workflows.setSecurityTeamMemberId(""); }} />;
  if (view === "day") return <MobileDayView location={dashboard.location} date={selectedDay ?? formatDateKey(new Date())} archive={archive} equipment={workflows.equipment} onBack={() => setView("calendar")} />;
  if (view === "additional") return <AdditionalChecksView locationName={dashboard.location.name} requirements={additional?.requirements ?? []} completions={additional?.completions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeAdditional} onBack={() => setView("today")} />;
  if (view === "managerReviews") return capabilities.canViewManagerReviews
    ? <ManagerReviews locationId={dashboard.location._id} locations={locations ?? [dashboard.location]} onBack={() => setView("today")} onOpenDailyChecks={() => setView("today")} />
    : <AccessDenied />;

  const todayProps: DashboardTodayProps = {
    ...workflows,
    dashboard,
    active: workflows.active!,
    onManagerReviews: openManagerReviews,
    canUseManagement: capabilities.canUseManagement,
    managerReviewStatus,
    onLogout: logout,
    todayLabel: dateLabel(),
    currentUserName: user?.name || user?.email || "Current user",
    renderTimestamp,
    viewTemperatureRecords,
    viewChecklistRecords,
    viewSecurityRecords,
    viewCleaningRecords,
    viewProbeRecords,
    viewWastageRecords,
    setView,
    additional,
    structuredTasks: workflows.active?.structuredTasks ?? [],
    onOpenStructuredTask: setStructuredTaskArea,
  };
  const mainView = view === "calendar"
    ? <CalendarView month={calendarMonth} setMonth={setCalendarMonth} days={calendar ?? []} onBack={() => setView("today")} onDay={(date: string) => { setSelectedDay(date); setView("day"); }} />
    : view === "training"
      ? <TrainingView locationName={dashboard.location.name} requirements={workflows.active?.trainingRequirements ?? []} completions={workflows.active?.trainingCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeTraining} onBack={() => setView("today")} />
      : view === "library"
        ? <LibraryView locationName={dashboard.location.name} documents={library?.documents ?? []} onBack={() => setView("today")} />
        : view === "admin"
          ? capabilities.canUseManagement
            ? <AdminSetup onBack={() => setView("today")} onOpenDay={(date, reportLocationId) => { switchLocation(reportLocationId); setSelectedDay(date); setView("day"); }} />
            : <AccessDenied />
          : <DashboardToday {...todayProps} />;
  const activeNavigation = view === "calendar" || view === "training" || view === "library" || view === "admin" ? view : "today";
  return <div className="min-h-screen bg-[#f6f7f5] pb-[calc(6.5rem+env(safe-area-inset-bottom))]">{mainView}<BottomNavigation onToday={() => setView("today")} onCalendar={() => setView("calendar")} onTraining={() => setView("training")} onLibrary={() => setView("library")} onAdmin={openManagementView} canUseManagement={capabilities.canUseManagement} active={activeNavigation} /></div>;
}
