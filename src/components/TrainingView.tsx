import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { useCallback, useState } from "react";
import VerifiedPdfPreview from "@/components/VerifiedPdfPreview";
import type { TeamMember, TrainingCompletion, TrainingRequirement } from "@/components/dashboard/dashboard-types";

const dateLabel = (value: string | number) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
const categoryLabels: Record<string, string> = {
  northern_rail: "Northern Rail",
  food_safety: "Food Safety",
  security: "Security",
  equipment: "Equipment",
  alcohol: "Alcohol",
  company_procedure: "Company Procedure",
  other: "Other",
};

const trainingFormatLabel = (requirement: { trainingFormat?: string | null }) =>
  requirement.trainingFormat === "document" ? "Document / PDF" : "Briefing";

type Props = {
  locationName: string;
  requirements: TrainingRequirement[];
  completions: TrainingCompletion[];
  teamMembers: TeamMember[];
  onComplete: (requirementId: string, teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

export default function TrainingView({
  locationName,
  requirements,
  completions,
  teamMembers,
  onComplete,
  onBack,
}: Props) {
  const [today] = useState(() => Date.now());
  const [filter, setFilter] = useState<"outstanding" | "all" | "employee">(
    "outstanding",
  );
  const [selectedRequirement, setSelectedRequirement] = useState<TrainingRequirement | null>(null);
  const [selectedMember, setSelectedMember] = useState("");
  const [acknowledgementTarget, setAcknowledgementTarget] = useState<{
    requirement: TrainingRequirement;
    member: TeamMember;
  } | null>(null);
  const [acknowledgementSaving, setAcknowledgementSaving] = useState(false);
  const [acknowledgementError, setAcknowledgementError] = useState<string | null>(null);
  const [acknowledgementPdfVerified, setAcknowledgementPdfVerified] = useState(false);
  const updateAcknowledgementPdfVerified = useCallback((verified: boolean) => setAcknowledgementPdfVerified(verified), []);
  const activeTeamMembers = teamMembers.filter(
    (member) => member.active !== false,
  );

  const applicableMembers = (requirement: TrainingRequirement) => {
    const applicableTeamMemberIds = requirement.applicableTeamMemberIds;
    if (Array.isArray(applicableTeamMemberIds)) {
      return activeTeamMembers.filter((member) =>
        applicableTeamMemberIds.includes(member._id),
      );
    }
    return activeTeamMembers;
  };

  const completionFor = (requirement: TrainingRequirement, memberId: string) => {
    const requiredVersion = requirement.requiredDocumentVersionNumber;
    const requiredContentVersion = requirement.requiredContentVersionNumber;
    return completions
      .filter(
        (item) =>
          item.requirementId === requirement._id &&
          item.teamMemberId === memberId,
      )
      .filter(
        (item) =>
          requiredVersion == null ||
          (item.documentVersionNumber != null &&
            item.documentVersionNumber >= requiredVersion),
      )
      .filter(
        (item) =>
          requiredContentVersion == null ||
          (item.contentVersionNumber != null &&
            item.contentVersionNumber >= requiredContentVersion),
      )
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0];
  };

  const completedCount = (requirement: TrainingRequirement) =>
    applicableMembers(requirement).filter((member) =>
      completionFor(requirement, member._id),
    ).length;
  const totalAssignments = requirements.reduce(
    (total, requirement) => total + applicableMembers(requirement).length,
    0,
  );
  const currentAssignments = requirements.reduce(
    (total, requirement) => total + completedCount(requirement),
    0,
  );
  const outstandingRequirements = requirements.filter((requirement) => {
    const members = applicableMembers(requirement);
    return members.length > 0 && completedCount(requirement) < members.length;
  });
  const visibleRequirements =
    filter === "outstanding" ? outstandingRequirements : requirements;
  const selectedMemberRecord = activeTeamMembers.find(
    (member) => member._id === selectedMember,
  );
  const employeeRequirements = selectedMember
    ? requirements.filter((requirement) =>
        applicableMembers(requirement).some(
          (member) => member._id === selectedMember,
        ),
      )
    : [];

  async function confirmAcknowledgement() {
    if (!acknowledgementTarget || acknowledgementSaving) return;
    setAcknowledgementSaving(true);
    setAcknowledgementError(null);
    try {
      await onComplete(
        acknowledgementTarget.requirement._id,
        acknowledgementTarget.member._id,
      );
      setAcknowledgementTarget(null);
    } catch (completeError) {
      setAcknowledgementError(completeError instanceof Error ? completeError.message : "The acknowledgement could not be saved. Please try again.");
    } finally {
      setAcknowledgementSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <p className="font-semibold">Training &amp; Acknowledgements</p>
            <p className="text-xs text-[#89918b]">{locationName}</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-7 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
          Learning records
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Training &amp; Acknowledgements
        </h1>
        <div className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5">
          <p className="text-2xl font-semibold">
            {totalAssignments
              ? `${currentAssignments} of ${totalAssignments} acknowledgements current`
              : "No training currently assigned"}
          </p>
          <p className="mt-1 text-sm text-[#727a74]">
            {requirements.length} requirements · {activeTeamMembers.length} team
            members
          </p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <Button
            size="sm"
            variant={filter === "outstanding" ? "default" : "outline"}
            onClick={() => setFilter("outstanding")}
          >
            Outstanding
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={filter === "employee" ? "default" : "outline"}
            onClick={() => setFilter("employee")}
          >
            By employee
          </Button>
        </div>
        {filter === "employee" ? (
          <div className="mt-5 space-y-3">
            <label className="block text-sm font-semibold">
              Team member
              <select
                value={selectedMember}
                onChange={(event) => setSelectedMember(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
              >
                <option value="">Select team member</option>
                {activeTeamMembers.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedMemberRecord && (
              <div className="space-y-2">
                {employeeRequirements.map((requirement) => {
                  const completion = completionFor(requirement, selectedMember);
                  return (
                    <div
                      key={requirement._id}
                      className="flex items-center justify-between rounded-2xl border border-black/[0.07] bg-white p-4"
                    >
                      <div>
                        <p className="font-semibold">{requirement.title}</p>
                        <p className="mt-1 text-xs text-[#89918b]">
                          {completion
                            ? `Completed ${dateLabel(completion.completedAt)}`
                            : "Outstanding"}
                        </p>
                      </div>
                      {completion ? (
                        <Check className="text-[#2d7951]" />
                      ) : (
                        <Button
                          size="sm"
                          className="bg-brand-yellow text-[#171717]"
                          onClick={() => {
                            setAcknowledgementError(null);
                            setAcknowledgementTarget({ requirement, member: selectedMemberRecord });
                          }}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  );
                })}
                {!employeeRequirements.length && (
                  <div className="rounded-2xl border border-black/[0.07] bg-white p-4 text-sm text-[#727a74]">
                    No training requirements apply to this employee.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {visibleRequirements.map((requirement) => {
              const members = applicableMembers(requirement);
              const count = completedCount(requirement);
              return (
                <button
                  type="button"
                  key={requirement._id}
                  onClick={() => setSelectedRequirement(requirement)}
                  className="flex w-full items-center justify-between rounded-2xl border border-black/[0.07] bg-white p-5 text-left"
                >
                  <div>
                    <p className="font-semibold">{requirement.title}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#89918b]">
                      {trainingFormatLabel(requirement)}
                    </p>
                    <p className="mt-1 text-sm text-[#727a74]">
                      {members.length
                        ? `${count} of ${members.length} complete · ${members.length - count} outstanding`
                        : "No applicable team members"}
                    </p>
                  </div>
                  <ChevronRight className="size-5 text-[#89918b]" />
                </button>
              );
            })}
            {!visibleRequirements.length && (
              <div className="rounded-2xl border border-[#cfe3d5] bg-[#fbfefb] p-5 text-sm text-[#2d7951]">
                All training requirements are complete.
              </div>
            )}
          </div>
        )}
        {selectedRequirement && (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                    Requirement
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    {selectedRequirement.title}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#fff7dc] px-3 py-1 text-[#80610e]">
                      {trainingFormatLabel(selectedRequirement)}
                    </span>
                    <span className="rounded-full bg-[#f2f5ef] px-3 py-1 text-[#4e5851]">
                      {applicableMembers(selectedRequirement).length > 0 &&
                      completedCount(selectedRequirement) ===
                        applicableMembers(selectedRequirement).length
                        ? "Acknowledged"
                        : "Not acknowledged"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#727a74]">
                    {applicableMembers(selectedRequirement).length
                      ? `${completedCount(selectedRequirement)} of ${applicableMembers(selectedRequirement).length} complete`
                      : "No applicable team members"}
                  </p>
                  {selectedRequirement.trainingInstructions && (
                    <div className="mt-4 whitespace-pre-wrap rounded-xl bg-[#fafbf9] p-4 text-sm leading-6 text-[#727a74]">
                      {selectedRequirement.trainingInstructions}
                    </div>
                  )}
                  {selectedRequirement.documentUrl && (
                    <div className="mt-4 space-y-2">
                      <VerifiedPdfPreview documentId={selectedRequirement.currentDocumentId} documentUrl={selectedRequirement.documentUrl} title={selectedRequirement.title} />
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedRequirement(null)}
                >
                  Close
                </Button>
              </div>
              <div className="mt-6 space-y-2">
                {applicableMembers(selectedRequirement).map((member) => {
                  const completion = completionFor(
                    selectedRequirement,
                    member._id,
                  );
                  return (
                    <div
                      key={member._id}
                      className="flex items-center justify-between rounded-xl bg-[#fafbf9] p-4"
                    >
                      <div>
                        <p className="font-semibold">{member.name}</p>
                        <p className="mt-1 text-xs text-[#89918b]">
                          {completion
                            ? `Acknowledged · ${dateLabel(completion.completedAt)}`
                            : "Not acknowledged"}
                        </p>
                      </div>
                      {completion ? (
                        <Check className="text-[#2d7951]" />
                      ) : (
                        <Button
                          size="sm"
                          className="bg-brand-yellow text-[#171717]"
                          onClick={() => {
                            setAcknowledgementError(null);
                            setAcknowledgementPdfVerified(false);
                            setAcknowledgementTarget({ requirement: selectedRequirement, member });
                          }}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {acknowledgementTarget && (
          <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                Training acknowledgement
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {acknowledgementTarget.requirement.title}
              </h2>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#89918b]">
                {trainingFormatLabel(acknowledgementTarget.requirement)}
              </p>
              {(acknowledgementTarget.requirement.trainingInstructions ??
                acknowledgementTarget.requirement.description) && (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#727a74]">
                  {acknowledgementTarget.requirement.trainingInstructions ??
                    acknowledgementTarget.requirement.description}
                </p>
              )}
              <p className="mt-4 text-sm font-semibold">
                Category:{" "}
                <span className="font-normal">
                  {categoryLabels[
                    acknowledgementTarget.requirement.category ?? "other"
                  ] ?? "Other"}
                </span>
              </p>
              {acknowledgementTarget.requirement.documentUrl && (
                <div className="mt-4 space-y-2">
                  <VerifiedPdfPreview documentId={acknowledgementTarget.requirement.currentDocumentId} documentUrl={acknowledgementTarget.requirement.documentUrl} title={acknowledgementTarget.requirement.title} className="h-[42vh] min-h-56" onVerifiedChange={updateAcknowledgementPdfVerified} />
                </div>
              )}
              {acknowledgementTarget.requirement.trainingFormat === "document" && !acknowledgementTarget.requirement.documentUrl && <p role="alert" className="mt-4 rounded-xl border border-[#efc8c3] p-3 text-sm text-[#a13d32]">The current PDF is unavailable, so this acknowledgement cannot be recorded.</p>}
              {acknowledgementTarget.requirement.currentDocumentVersionNumber !=
                null && (
                <p className="mt-3 text-sm text-[#727a74]">
                  Current document version:{" "}
                  {
                    acknowledgementTarget.requirement
                      .currentDocumentVersionNumber
                  }
                </p>
              )}
              <div className="mt-4 space-y-1 text-sm">
                <p>
                  <span className="font-semibold">Employee:</span>{" "}
                  {acknowledgementTarget.member.name}
                </p>
                <p>
                  <span className="font-semibold">Today:</span>{" "}
                  {dateLabel(today)}
                </p>
              </div>
              <p className="mt-5 rounded-xl bg-[#fafbf9] p-4 text-sm font-semibold">
                I confirm I have read and understood this training requirement.
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAcknowledgementTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={acknowledgementSaving || (acknowledgementTarget.requirement.trainingFormat === "document" && !acknowledgementPdfVerified)}
                  className="bg-brand-yellow text-[#171717]"
                  onClick={confirmAcknowledgement}
                >
                  {acknowledgementSaving ? "Saving…" : "Complete Acknowledgement"}
                </Button>
              </div>
              {acknowledgementError && <p role="alert" className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#8f3a31]">{acknowledgementError}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
