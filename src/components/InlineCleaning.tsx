import StructuredTaskWorkflow from "@/components/StructuredTaskWorkflow";
import type {
  StructuredTask,
  StructuredTaskResponse,
  TeamMember,
} from "@/components/dashboard/dashboard-types";

type CleaningCompletion = {
  taskId: string;
  completedAt?: number | string;
  teamMemberId?: string | null;
  teamMemberName?: string | null;
};

type Props = {
  locationId: string;
  locationName: string;
  tasks: StructuredTask[];
  responses: StructuredTaskResponse[];
  completions: CleaningCompletion[];
  teamMembers: TeamMember[];
  onComplete: (taskId: string, teamMemberId: string) => Promise<void>;
  onIssue?: (description: string, teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

/**
 * Cleaning keeps its historical entry point, but uses the same structured
 * checklist renderer as Opening, Closing and Security for every item type.
 */
export default function InlineCleaning({
  locationId,
  locationName,
  tasks,
  responses,
  completions,
  teamMembers,
  onComplete,
  onIssue,
  onBack,
}: Props) {
  return (
    <StructuredTaskWorkflow
      locationId={locationId}
      locationName={locationName}
      area="cleaning"
      tasks={tasks}
      responses={responses}
      cleaningCompletions={completions}
      teamMembers={teamMembers}
      onCompleteCleaning={onComplete}
      onReportCleaningIssue={onIssue}
      onBack={onBack}
    />
  );
}
