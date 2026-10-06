import { Button } from "@/components/ui/button";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  selectedQuestionMember,
  selectedSignOffMember,
  type PendingMemberOverrides,
} from "@/lib/team-handover";

type ChecklistQuestion = { _id: string; question: string };
type ChecklistResponse = {
  questionId: string;
  answer: string;
  action?: string | null;
  teamMemberId?: string | null;
  createdAt?: number | string;
};
type TeamMember = { _id: string; name: string };

type Props = {
  title: string;
  questions: ChecklistQuestion[];
  responses: ChecklistResponse[];
  teamMembers: TeamMember[];
  perTaskSignOff?: boolean;
  onComplete: (questionId: string, teamMemberId: string) => Promise<void>;
  onIssue: (
    questionId: string,
    problem: string,
    action: string,
    teamMemberId: string,
  ) => Promise<void>;
  onSignOff: (teamMemberId: string) => Promise<void>;
  onBack: () => void;
};

const timeLabel = (value?: number | string) =>
  value === undefined
    ? null
    : new Date(value).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

export default function InlineChecklist({
  title,
  questions,
  responses,
  teamMembers,
  perTaskSignOff = false,
  onComplete,
  onIssue,
  onSignOff,
  onBack,
}: Props) {
  const [issueQuestion, setIssueQuestion] = useState<ChecklistQuestion | null>(
    null,
  );
  const [problem, setProblem] = useState("");
  const [action, setAction] = useState("");
  const [workflowTeamMemberId, setWorkflowTeamMemberId] = useState("");
  const [issueTeamMemberId, setIssueTeamMemberId] = useState("");
  const [signOffTeamMemberId, setSignOffTeamMemberId] = useState("");
  const [questionMemberOverrides, setQuestionMemberOverrides] =
    useState<PendingMemberOverrides>({});
  const complete =
    questions.length > 0 &&
    questions.every((question) =>
      responses.some((response) => response.questionId === question._id),
    );
  const responseFor = (id: string) =>
    responses.find((response) => response.questionId === id);
  const memberName = (id?: string | null) =>
    id
      ? (teamMembers.find((member) => member._id === id)?.name ??
        "Not recorded")
      : "Not recorded";

  async function saveIssue() {
    const memberId =
      issueTeamMemberId ||
      (issueQuestion
        ? selectedQuestionMember(
            issueQuestion._id,
            questionMemberOverrides,
            workflowTeamMemberId,
          )
        : workflowTeamMemberId);
    if (!issueQuestion || !problem.trim() || !action.trim() || !memberId)
      return;
    await onIssue(issueQuestion._id, problem, action, memberId);
    setIssueQuestion(null);
    setProblem("");
    setAction("");
    setIssueTeamMemberId("");
  }

  async function signOff() {
    const memberId = selectedSignOffMember(
      signOffTeamMemberId,
      workflowTeamMemberId,
    );
    if (!complete || !memberId) return;
    await onSignOff(memberId);
  }

  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-5 py-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="size-5" />
          </Button>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-[#89918b]">Complete jobs in any order</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-7 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
              Daily checklist
            </p>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          </div>
          <p className="text-sm text-[#727a74]">
            {responses.length} of {questions.length}
          </p>
        </div>
        <label className="mb-5 block text-sm font-semibold">
          Current team member
          <select
            value={workflowTeamMemberId}
            onChange={(event) => setWorkflowTeamMemberId(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
          >
            <option value="">Select team member before starting</option>
            {teamMembers.map((member) => (
              <option key={member._id} value={member._id}>
                {member.name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          {questions.map((question) => {
            const response = responseFor(question._id);
            const issueOpen = issueQuestion?._id === question._id;
            const questionMemberId = selectedQuestionMember(
              question._id,
              questionMemberOverrides,
              workflowTeamMemberId,
            );
            const recordedTime = timeLabel(response?.createdAt);
            return (
              <div
                key={question._id}
                className={`rounded-2xl border bg-white p-4 ${response?.answer === "no" ? "border-[#efc8c3]" : "border-black/[0.07]"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p
                      className={`text-sm font-semibold ${response ? "text-[#59625c]" : "text-[#171918]"}`}
                    >
                      {question.question}
                    </p>
                    {response && (
                      <p className="mt-1 text-xs text-[#727a74]">
                        Completed by {memberName(response.teamMemberId)}
                        {recordedTime ? ` · ${recordedTime}` : ""}
                      </p>
                    )}
                  </div>
                  {response ? (
                    <span
                      className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${response.answer === "no" ? "text-[#b64738]" : "text-[#2d7951]"}`}
                    >
                      {response.answer === "no" ? "Issue" : "Completed"}{" "}
                      <Check className="size-4" />
                    </span>
                  ) : (
                    <div className="grid w-full gap-2 sm:ml-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.6fr)]">
                      <select
                        aria-label={`Completed by for ${question.question}`}
                        value={questionMemberId}
                        onChange={(event) =>
                          setQuestionMemberOverrides((current) => ({
                            ...current,
                            [question._id]: event.target.value,
                          }))
                        }
                        className="h-11 min-w-0 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm"
                      >
                        <option value="">Completed by…</option>
                        {teamMembers.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          aria-label="Mark complete"
                          size="icon"
                          disabled={!questionMemberId}
                          className="h-11 w-full bg-[#2d7951] text-white hover:bg-[#246442]"
                          onClick={() =>
                            onComplete(question._id, questionMemberId)
                          }
                        >
                          <Check className="size-5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!questionMemberId}
                          onClick={() => {
                            setIssueQuestion(question);
                            setProblem("");
                            setAction("");
                            setIssueTeamMemberId("");
                          }}
                        >
                          Issue
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {response?.answer === "no" && (
                  <div className="mt-3 rounded-xl bg-[#fff5f3] p-3 text-sm">
                    <p className="font-semibold text-[#8f3a31]">
                      Action recorded
                    </p>
                    <p className="mt-1 text-[#727a74]">{response.action}</p>
                  </div>
                )}
                {issueOpen && (
                  <div className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-4">
                    <p className="font-semibold text-[#8f3a31]">
                      Action required
                    </p>
                    <label className="mt-3 block text-sm font-semibold">
                      What was wrong?
                      <textarea
                        value={problem}
                        onChange={(event) => setProblem(event.target.value)}
                        className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3"
                        placeholder="Enter details"
                      />
                    </label>
                    <label className="mt-3 block text-sm font-semibold">
                      What action was taken?
                      <textarea
                        value={action}
                        onChange={(event) => setAction(event.target.value)}
                        className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3"
                        placeholder="Enter corrective action"
                      />
                    </label>
                    <label className="mt-3 block text-sm font-semibold">
                      Reported by
                      <select
                        value={issueTeamMemberId || questionMemberId}
                        onChange={(event) =>
                          setIssueTeamMemberId(event.target.value)
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                      >
                        <option value="">Select team member</option>
                        {teamMembers.map((member) => (
                          <option key={member._id} value={member._id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      disabled={
                        !problem.trim() ||
                        !action.trim() ||
                        !(issueTeamMemberId || questionMemberId)
                      }
                      className="mt-3 h-11 bg-[#202522] text-white"
                      onClick={saveIssue}
                    >
                      Report issue
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {!perTaskSignOff && (
          <div className="mt-6 rounded-2xl border border-black/[0.07] bg-white p-4">
            <p className="font-semibold">Checklist sign-off</p>
            <p className="mt-1 text-sm text-[#727a74]">
              Sign off the complete checklist once every question has been
              answered.
            </p>
            <label className="mt-4 block text-sm font-semibold">
              Signed off by
              <select
                value={selectedSignOffMember(
                  signOffTeamMemberId,
                  workflowTeamMemberId,
                )}
                onChange={(event) => setSignOffTeamMemberId(event.target.value)}
                className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
              >
                <option value="">Select team member</option>
                {teamMembers.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              disabled={
                !complete ||
                !selectedSignOffMember(
                  signOffTeamMemberId,
                  workflowTeamMemberId,
                )
              }
              className="mt-4 h-12 w-full bg-[#ffde56] font-semibold text-[#171717]"
              onClick={signOff}
            >
              Complete {title} <Check className="ml-2 size-4" />
            </Button>
          </div>
        )}
        <Button variant="outline" className="mt-7 w-full" onClick={onBack}>
          View all checks <ChevronRight className="ml-2 size-4" />
        </Button>
      </main>
    </div>
  );
}
