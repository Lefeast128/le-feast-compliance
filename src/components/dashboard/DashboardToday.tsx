import IssueDetail from "@/components/IssueDetail";
import TaskIssueModal from "@/components/TaskIssueModal";
import StaffWastageModal from "@/components/WastageModal";
import { DailyChecksJourney } from "@/components/dashboard/DailyChecksJourney";
import {
  buildDailyTaskModels,
  getIssueAttentionTaskIds,
  getProgressMessage,
  getProgressPercent,
  type DailyTaskModel,
} from "@/components/dashboard/daily-checks-model";
import { ProbeModal } from "@/components/dashboard/DashboardWorkflowScreens";
import type {
  DashboardData,
  DashboardIssue,
  DashboardView,
  Equipment,
  ManagerReviewStatus,
  TemperatureRound,
  StructuredTask,
} from "@/components/dashboard/dashboard-types";
import {
  buildWastagePayload,
  type WastagePickerProduct,
} from "@/lib/wastage-picker";
import { Header } from "@/components/dashboard/DashboardPrimitives";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

export type DashboardTodayProps = {
  dashboard: DashboardData;
  active: DashboardData;
  onManagerReviews: () => void;
  canUseManagement: boolean;
  managerReviewStatus?: ManagerReviewStatus | null;
  onLogout: () => void | Promise<void>;
  todayLabel: string;
  currentUserName: string;
  renderTimestamp: number;
  requiredComplete: number;
  equipment: Equipment[];
  memberName: (id?: string) => string;
  amRound?: TemperatureRound;
  pmRound?: TemperatureRound;
  amComplete: boolean;
  pmComplete: boolean;
  openingComplete: boolean;
  closingComplete: boolean;
  amSecurityComplete: boolean;
  pmSecurityComplete: boolean;
  openIssues: DashboardIssue[];
  beginRound: (session: "AM" | "PM") => void | Promise<void>;
  viewTodayRecords: () => void;
  setView: Dispatch<SetStateAction<DashboardView>>;
  additional?: { requirements: unknown[]; completions: unknown[] };
  setCleaningList: Dispatch<SetStateAction<boolean>>;
  setChecklistList: Dispatch<SetStateAction<"opening" | "closing" | null>>;
  beginSecurity: (session: "AM" | "PM") => void;
  setProbeProduct: Dispatch<SetStateAction<string>>;
  setProbeFailed: Dispatch<SetStateAction<boolean>>;
  setProbeIssueId: Dispatch<SetStateAction<string | null>>;
  setProbeQuantity: Dispatch<SetStateAction<string>>;
  setProbeOpen: Dispatch<SetStateAction<boolean>>;
  probeOpen: boolean;
  probeProduct: string;
  probeQuantity: string;
  probeTemperature: string;
  setProbeTemperature: Dispatch<SetStateAction<string>>;
  probeFailed: boolean;
  saveProbe: (teamMemberId: string) => Promise<void>;
  issueOpen: boolean;
  setIssueOpen: Dispatch<SetStateAction<boolean>>;
  saveIssue: (description: string, teamMemberId: string) => Promise<void>;
  wastageOpen: boolean;
  openWastage: () => void;
  setWastageOpen: Dispatch<SetStateAction<boolean>>;
  wastageCatalogue: WastagePickerProduct[];
  wastageCatalogueLoading: boolean;
  wastageCatalogueError: string | null;
  saveWastage: (
    payload: ReturnType<typeof buildWastagePayload>,
  ) => Promise<void>;
  issueSelected: DashboardIssue | null;
  setIssueSelected: Dispatch<SetStateAction<DashboardIssue | null>>;
  addIssueUpdate: (args: Record<string, unknown>) => Promise<unknown>;
  structuredTasks: StructuredTask[];
  onOpenStructuredTask: (area: StructuredTask["area"]) => void;
};

export default function DashboardToday({
  dashboard,
  active,
  onManagerReviews,
  canUseManagement,
  managerReviewStatus,
  onLogout,
  todayLabel,
  currentUserName,
  renderTimestamp,
  requiredComplete,
  equipment,
  memberName,
  amRound,
  pmRound,
  amComplete,
  pmComplete,
  openingComplete,
  closingComplete,
  amSecurityComplete,
  pmSecurityComplete,
  openIssues,
  beginRound,
  viewTodayRecords,
  setView,
  additional,
  setCleaningList,
  setChecklistList,
  beginSecurity,
  setProbeProduct,
  setProbeFailed,
  setProbeIssueId,
  setProbeQuantity,
  setProbeOpen,
  probeOpen,
  probeProduct,
  probeQuantity,
  probeTemperature,
  setProbeTemperature,
  probeFailed,
  saveProbe,
  issueOpen,
  setIssueOpen,
  saveIssue,
  wastageOpen,
  openWastage,
  setWastageOpen,
  wastageCatalogue,
  wastageCatalogueLoading,
  wastageCatalogueError,
  saveWastage,
  issueSelected,
  setIssueSelected,
  addIssueUpdate,
  structuredTasks,
  onOpenStructuredTask,
}: DashboardTodayProps) {
  const cleaningTasks = structuredTasks.filter(task => task.area === "cleaning");
  const cleaningCompleted = cleaningTasks.length
    ? cleaningTasks.filter(task => task.taskType === "with_steps"
      ? (task.steps ?? []).filter(step => step.required !== false).every(step => active.structuredTaskResponses.some(response => response.taskId === task._id && response.taskArea === "cleaning" && response.stepId === step.id))
      : active.structuredTaskResponses.some(response => response.taskId === task._id && response.taskArea === "cleaning" && response.stepId === "simple") || active.cleaningCompletions.some(completion => completion.taskId === task._id)).length
    : active.cleaningCompletions.length;
  const issueAttentionTaskIds = getIssueAttentionTaskIds({
    issues: openIssues,
    temperatureReadings: active.readings,
    temperatureRounds: active.rounds,
    structuredTasks,
  });
  const tasks = buildDailyTaskModels({
    equipmentCount: equipment.length,
    amComplete,
    pmComplete,
    amInProgress: Boolean(amRound && !amComplete),
    pmInProgress: Boolean(pmRound && !pmComplete),
    openingComplete,
    closingComplete,
    amSecurityComplete,
    pmSecurityComplete,
    foodProbeCount: active.foodChecks.length,
    cleaningCompleted,
    cleaningDue: cleaningTasks.length || active.cleaningTasks.length,
    additionalCompleted: additional?.completions.length ?? 0,
    additionalDue: additional?.requirements.length ?? 0,
    wastageCount: active.wastageRecords.length,
    issueAttentionTaskIds,
  });

  const taskAction = (task: DailyTaskModel) => {
    switch (task.id) {
      case "am-temperature":
        if (amComplete) viewTodayRecords();
        else void beginRound("AM");
        break;
      case "pm-temperature":
        if (pmComplete) viewTodayRecords();
        else void beginRound("PM");
        break;
      case "opening-checklist":
        if (openingComplete) viewTodayRecords();
        else setChecklistList("opening");
        break;
      case "closing-checklist":
        if (closingComplete) viewTodayRecords();
        else setChecklistList("closing");
        break;
      case "am-security":
        if (structuredTasks.some(task => task.area === "security_am" && task.taskType === "with_steps")) onOpenStructuredTask("security_am");
        else if (amSecurityComplete) viewTodayRecords();
        else beginSecurity("AM");
        break;
      case "pm-security":
        if (structuredTasks.some(task => task.area === "security_pm" && task.taskType === "with_steps")) onOpenStructuredTask("security_pm");
        else if (pmSecurityComplete) viewTodayRecords();
        else beginSecurity("PM");
        break;
      case "food-probes":
        setProbeProduct(active.probeProducts[0]?.name ?? "");
        setProbeFailed(false);
        setProbeIssueId(null);
        setProbeQuantity("");
        setProbeOpen(true);
        break;
      case "cleaning":
        if (structuredTasks.some(task => task.area === "cleaning" && task.taskType === "with_steps")) onOpenStructuredTask("cleaning");
        else setCleaningList(true);
        break;
      case "additional-checks":
        setView("additional");
        break;
      case "wastage":
        openWastage();
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f6f7f5] pb-24 text-[#171918]">
      <Header onLogout={onLogout} />
      <DailyChecksJourney
        locationName={dashboard.location.name}
        todayLabel={todayLabel}
        currentUserName={currentUserName}
        completed={requiredComplete}
        total={6}
        progressPercent={getProgressPercent(requiredComplete, 6)}
        progressMessage={getProgressMessage(requiredComplete, 6)}
        tasks={tasks}
        onTaskAction={taskAction}
        canUseManagement={canUseManagement}
        managerReviewStatus={managerReviewStatus}
        onManagerReviews={onManagerReviews}
        openIssues={openIssues}
        onIssueSelected={setIssueSelected}
        onReportIssue={() => setIssueOpen(true)}
      />
      {canUseManagement && (
        <span className="sr-only">Weekly review and 4-week review status remain manager-only.</span>
      )}
      {probeOpen && (
        <ProbeModal
          products={active.probeProducts}
          teamMembers={dashboard.teamMembers}
          product={probeProduct}
          setProduct={setProbeProduct}
          quantity={probeQuantity}
          setQuantity={setProbeQuantity}
          temperature={probeTemperature}
          setTemperature={setProbeTemperature}
          failed={probeFailed}
          onSave={saveProbe}
          onClose={() => {
            setProbeOpen(false);
            setProbeFailed(false);
            setProbeIssueId(null);
          }}
        />
      )}
      {issueOpen && (
        <TaskIssueModal
          teamMembers={dashboard.teamMembers}
          onClose={() => setIssueOpen(false)}
          onSave={saveIssue}
        />
      )}
      {wastageOpen && (
        <StaffWastageModal
          products={wastageCatalogue}
          teamMembers={dashboard.teamMembers}
          loading={wastageCatalogueLoading}
          error={wastageCatalogueError}
          onSave={saveWastage}
          onClose={() => setWastageOpen(false)}
        />
      )}
      {issueSelected && (
        <IssueDetail
          issue={issueSelected}
          teamMembers={dashboard.teamMembers}
          onUpdate={async (args: Record<string, unknown>) => {
            await addIssueUpdate(args);
            const refreshed = dashboard.issues.find(
              (item) => item._id === issueSelected._id,
            );
            if (refreshed) setIssueSelected(refreshed);
            toast.success("Issue update saved");
          }}
          onClose={() => setIssueSelected(null)}
        />
      )}
      <span className="sr-only">Rendered at {renderTimestamp}</span>
      <span className="sr-only">
        {memberName(amRound?.teamMemberId)} {memberName(pmRound?.teamMemberId)}
      </span>
    </div>
  );
}
