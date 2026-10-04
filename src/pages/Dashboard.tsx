import AdminSetup from "@/components/AdminSetup";
import AdditionalChecksView from "@/components/AdditionalChecksView";
import InlineChecklist from "@/components/InlineChecklist";
import InlineCleaning from "@/components/InlineCleaning";
import MobileDayView from "@/components/MobileDayView";
import TrainingView from "@/components/TrainingView";
import TemperatureActionScreen from "@/components/TemperatureActionScreen";
import TemperatureRoundEntry from "@/components/TemperatureRoundEntry";
import CalendarView from "@/components/dashboard/CalendarView";
import DashboardToday, { type DashboardTodayProps } from "@/components/dashboard/DashboardToday";
import { SecurityScreen } from "@/components/dashboard/DashboardWorkflowScreens";
import { useDashboardWorkflows } from "@/components/dashboard/useDashboardWorkflows";
import type { CalendarDay, DashboardData, DashboardLocation, DashboardView } from "@/components/dashboard/dashboard-types";
import { useAuth } from "@/hooks/use-auth";
import { restApi, useRestQuery } from "@/lib/rest-domain";
import { formatDateKey } from "@/lib/date-key";
import { useState } from "react";

const dateLabel = (value = new Date()) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(value);
const monthBounds = (value: Date) => ({ start: formatDateKey(new Date(value.getFullYear(), value.getMonth(), 1)), end: formatDateKey(new Date(value.getFullYear(), value.getMonth() + 1, 0)) });

export default function Dashboard() {
  const { logout } = useAuth();
  const [renderTimestamp] = useState(() => Date.now());
  const [locationId, setLocationId] = useState<string | null>(null);
  const [view, setView] = useState<DashboardView>("today");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const bounds = monthBounds(calendarMonth);
  const locations = useRestQuery<DashboardLocation[]>("locations", restApi.locations.myLocations, true);
  const currentLocationId = locationId ?? locations?.[0]?._id ?? null;
  const dashboard = useRestQuery<DashboardData | null>(currentLocationId ? `dashboard:${currentLocationId}` : null, () => restApi.compliance.dashboard({ locationId: currentLocationId }), Boolean(currentLocationId));
  const additional = useRestQuery(dashboard ? `additional:${dashboard.location._id}` : null, () => restApi.additional.dashboard({ locationId: dashboard!.location._id }), Boolean(dashboard));
  const calendar = useRestQuery<CalendarDay[]>(view === "calendar" && dashboard ? `calendar:${dashboard.location._id}:${bounds.start}:${bounds.end}` : null, () => restApi.compliance.calendar({ locationId: dashboard!.location._id, monthStart: bounds.start, monthEnd: bounds.end }), Boolean(view === "calendar" && dashboard));
  const archive = useRestQuery(view === "day" && dashboard && selectedDay ? `archive:${dashboard.location._id}:${selectedDay}` : null, () => restApi.compliance.archive({ locationId: dashboard!.location._id, start: selectedDay!, end: selectedDay! }), Boolean(view === "day" && dashboard && selectedDay));
  const workflows = useDashboardWorkflows({ dashboard, currentLocationId });

  function switchLocation(nextLocationId: string) {
    if (!nextLocationId || nextLocationId === currentLocationId) return;
    setLocationId(nextLocationId);
    setView("today");
    workflows.resetForLocation();
  }

  function viewTodayRecords() {
    setSelectedDay(formatDateKey(new Date()));
    setView("day");
  }

  if (dashboard === undefined) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5] p-6"><div className="rounded-2xl border border-black/[0.07] bg-white px-6 py-5 text-center"><p className="font-semibold">Loading today&apos;s checks…</p><p className="mt-1 text-sm text-[#727a74]">Connecting to your Le Feast store.</p></div></div>;
  if (dashboard === null) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7f5] p-6"><div className="max-w-md rounded-2xl border border-[#efc8c3] bg-white p-6 text-center"><p className="font-semibold text-[#202522]">Store access required</p><p className="mt-2 text-sm text-[#727a74]">Your account does not currently have access to a Le Feast store. Please contact an administrator.</p></div></div>;

  if (workflows.round && workflows.roundIssues.length) return <TemperatureActionScreen session={workflows.round} issues={workflows.roundIssues} teamMembers={dashboard.teamMembers} issueProgress={workflows.issueProgress} setIssueProgress={workflows.setIssueProgress} onSaveActions={workflows.saveTemperatureActions} onRecheck={workflows.saveTemperatureRecheck} onBack={() => { workflows.resetForLocation(); }} />;
  if (workflows.round) return <TemperatureRoundEntry session={workflows.round} equipment={workflows.roundEquipment} teamMembers={dashboard.teamMembers} temperatures={workflows.temperatures} setTemperatures={workflows.setTemperatures} submitting={workflows.roundSubmitting} onComplete={workflows.completeTemperatureRound} onBack={() => workflows.resetForLocation()} />;
  if (workflows.cleaningList) return <InlineCleaning key={dashboard.location._id} locationName={dashboard.location.name} tasks={workflows.active?.cleaningTasks ?? []} completions={workflows.active?.cleaningCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeCleaning} onBack={() => workflows.setCleaningList(false)} />;
  if (workflows.checklistList) return <InlineChecklist key={`${dashboard.location._id}:${workflows.checklistList}`} title={workflows.checklistList === "opening" ? "Opening checklist" : "Closing checklist"} questions={workflows.active?.checklists[workflows.checklistList].questions ?? []} responses={workflows.active?.checklists[workflows.checklistList].responses ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeChecklistQuestion} onIssue={workflows.saveChecklistIssue} onSignOff={workflows.signOffChecklistTask} onBack={() => workflows.setChecklistList(null)} />;
  if (workflows.security && workflows.currentSecurityQuestion) return <SecurityScreen session={workflows.security} question={workflows.currentSecurityQuestion.question} index={workflows.securityIndex} total={workflows.active?.security[workflows.security].length ?? 0} teamMembers={dashboard.teamMembers} teamMemberId={workflows.securityTeamMemberId} setTeamMemberId={workflows.setSecurityTeamMemberId} issue={workflows.securityIssue} setIssue={workflows.setSecurityIssue} onSave={workflows.saveSecurity} onBack={() => { workflows.setSecurity(null); workflows.setSecurityTeamMemberId(""); }} />;
  if (view === "calendar") return <CalendarView month={calendarMonth} setMonth={setCalendarMonth} days={calendar ?? []} onBack={() => setView("today")} onDay={(date: string) => { setSelectedDay(date); setView("day"); }} />;
  if (view === "day") return <MobileDayView location={dashboard.location} date={selectedDay ?? formatDateKey(new Date())} archive={archive} equipment={workflows.equipment} onBack={() => setView("calendar")} />;
  if (view === "training") return <TrainingView locationName={dashboard.location.name} requirements={workflows.active?.trainingRequirements ?? []} completions={workflows.active?.trainingCompletions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeTraining} onBack={() => setView("today")} />;
  if (view === "additional") return <AdditionalChecksView locationName={dashboard.location.name} requirements={additional?.requirements ?? []} completions={additional?.completions ?? []} teamMembers={dashboard.teamMembers} onComplete={workflows.completeAdditional} onBack={() => setView("today")} />;
  if (view === "admin") return <AdminSetup onBack={() => setView("today")} onOpenDay={(date, reportLocationId) => { switchLocation(reportLocationId); setSelectedDay(date); setView("day"); }} />;

  const todayProps: DashboardTodayProps = {
    ...workflows,
    dashboard,
    active: workflows.active!,
    locations,
    locationId,
    onLocationChange: switchLocation,
    onAdmin: () => setView("admin"),
    onCalendar: () => setView("calendar"),
    onTraining: () => setView("training"),
    onLogout: logout,
    todayLabel: dateLabel(),
    renderTimestamp,
    viewTodayRecords,
    setView,
    additional,
  };
  return <DashboardToday {...todayProps} />;
}
