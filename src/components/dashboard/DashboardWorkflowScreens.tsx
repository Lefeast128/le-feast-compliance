import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Choice,
  Modal,
  TemperatureInput,
} from "@/components/dashboard/DashboardPrimitives";
import type {
  ProbeProduct,
  TeamMember,
} from "@/components/dashboard/dashboard-types";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";
import { useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronRight } from "lucide-react";
import { ActiveStaffControl } from "@/components/dashboard/StaffAttribution";

type Answer = "yes" | "no" | "na" | null;

type ProbeModalProps = {
  products: ProbeProduct[];
  teamMembers: TeamMember[];
  product: string;
  setProduct: Dispatch<SetStateAction<string>>;
  quantity: string;
  setQuantity: Dispatch<SetStateAction<string>>;
  temperature: string;
  setTemperature: Dispatch<SetStateAction<string>>;
  failed: boolean;
  onSave: (teamMemberId: string) => void | Promise<void>;
  onClose: () => void;
};

export function ProbeModal({
  products,
  teamMembers,
  product,
  setProduct,
  quantity,
  setQuantity,
  temperature,
  setTemperature,
  failed,
  onSave,
  onClose,
}: ProbeModalProps) {
  const [selected] = products.filter((item) => item.name === product);
  const minimum = selected?.minimumTemperature ?? 76;
  const holdMinutes = selected?.holdMinutes ?? 2;
  const currentlyFailed = Boolean(temperature) && Number(temperature) < minimum;
  const [teamMemberId, setTeamMemberId] = useState("");
  return (
    <Modal
      title={failed ? "Record probe recheck" : "Record food probe"}
      eyebrow="Food probes"
      onClose={onClose}
    >
      <label className="block text-sm font-semibold">
        Product
        <select
          disabled={failed}
          value={product}
          onChange={(event) => setProduct(event.target.value)}
          className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
        >
          <option value="">Select product</option>
          {products.map((item) => (
            <option key={item._id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Quantity / batch
        <Input
          disabled={failed}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          className="mt-2 h-12"
          placeholder="e.g. 20 sausages"
        />
      </label>
      <label className="mt-4 block text-sm font-semibold">
        Core temperature
        <TemperatureInput
          value={temperature}
          setValue={setTemperature}
          min={50}
          max={100}
          safeMin={minimum}
          safeMax={100}
        />
      </label>
      {(failed || currentlyFailed) && (
        <div className="mt-5 rounded-xl border border-[#efc8c3] bg-[#fff5f3] p-4 text-sm text-[#8f3a31]">
          <p className="font-semibold">
            {failed ? "RECHECK TEMPERATURE" : "CONTINUE COOKING"}
          </p>
          <p className="mt-1">
            {failed
              ? "The original failed reading is retained. Enter the new reading after cooking."
              : `${temperature}°C is below the ${minimum}°C / ${holdMinutes}-minute standard.`}
          </p>
        </div>
      )}
      <div className="mt-5"><ActiveStaffControl teamMembers={teamMembers} value={teamMemberId} onChange={setTeamMemberId} label="Completing probe as" /></div>
      <Button
        aria-label="Mark complete"
        disabled={!product || !quantity.trim() || !temperature || !teamMemberId}
        className="mt-7 h-14 w-full bg-[#2d7951] text-lg font-semibold text-white hover:bg-[#246442]"
        onClick={() => onSave(teamMemberId)}
      >
        <span className="sr-only">Mark complete</span>
        <Check className="size-6" />
      </Button>
    </Modal>
  );
}

type ChecklistScreenProps = {
  title: string;
  question: string;
  index: number;
  total: number;
  teamMembers: TeamMember[];
  teamMemberId: string;
  setTeamMemberId: Dispatch<SetStateAction<string>>;
  answer: Answer;
  setAnswer: Dispatch<SetStateAction<Answer>>;
  problem: string;
  setProblem: Dispatch<SetStateAction<string>>;
  action: string;
  setAction: Dispatch<SetStateAction<string>>;
  onSave: () => void | Promise<void>;
  onBack: () => void;
};

export function ChecklistScreen({
  title,
  question,
  index,
  total,
  teamMembers,
  teamMemberId,
  setTeamMemberId,
  answer,
  setAnswer,
  problem,
  setProblem,
  action,
  setAction,
  onSave,
  onBack,
}: ChecklistScreenProps) {
  return (
    <div className="min-h-screen bg-[#f6f7f5]">
      <OperationalHeader
        title={title}
        eyebrow="Daily checks"
        date={operationalDateLabel()}
        progress={{ complete: index, total }}
        onBack={onBack}
      />
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
          Question {index + 1} of {total}
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-tight">
          {question}
        </h1>
        <label className="mt-8 block text-sm font-semibold">
          Responsible team member
          <select
            value={teamMemberId}
            onChange={(event) => setTeamMemberId(event.target.value)}
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
        <div className="mt-8 grid gap-3">
          <Choice
            label="YES"
            active={answer === "yes"}
            onClick={() => setAnswer("yes")}
          />
          <Choice
            label="NO"
            active={answer === "no"}
            onClick={() => setAnswer("no")}
          />
          <Choice
            label="N/A"
            active={answer === "na"}
            onClick={() => setAnswer("na")}
          />
        </div>
        {answer === "no" && (
          <div className="mt-6 rounded-2xl border border-[#efc8c3] bg-[#fff8f6] p-5">
            <p className="font-semibold text-[#8f3a31]">
              Action required before continuing
            </p>
            <label className="mt-4 block text-sm font-semibold">
              What was wrong?
              <textarea
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                placeholder="Enter details"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold">
              What action was taken?
              <textarea
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] bg-white p-3 text-sm"
                placeholder="Enter corrective action"
              />
            </label>
          </div>
        )}
        <Button
          disabled={
            !teamMemberId || !answer || (answer === "no" && !action.trim())
          }
          className="mt-7 h-14 w-full bg-[#f4c542] text-lg font-semibold text-[#171717]"
          onClick={onSave}
        >
          {index + 1 === total ? "Complete check" : "Save & next question"}
          <ChevronRight className="ml-2 size-5" />
        </Button>
        <p className="mt-4 text-center text-sm text-[#89918b]">
          {index} of {total} completed
        </p>
      </main>
    </div>
  );
}

type SecurityScreenProps = {
  session: "AM" | "PM";
  question: string;
  index: number;
  total: number;
  teamMembers: TeamMember[];
  teamMemberId: string;
  setTeamMemberId: Dispatch<SetStateAction<string>>;
  issue: string;
  setIssue: Dispatch<SetStateAction<string>>;
  onSave: () => void | Promise<void>;
  onBack: () => void;
};

export function SecurityScreen({
  session,
  question,
  index,
  total,
  teamMembers,
  teamMemberId,
  setTeamMemberId,
  issue,
  setIssue,
  onSave,
  onBack,
}: SecurityScreenProps) {
  const last = index + 1 === total;
  return (
    <div className="min-h-screen bg-[#f6f7f5]">
      <OperationalHeader
        title={`${session} Security Check`}
        eyebrow="Daily checks"
        date={operationalDateLabel()}
        subtitle="Complete each security question and sign off the session."
        progress={{ complete: index, total }}
        onBack={onBack}
      />
      <main className="mx-auto max-w-xl px-5 py-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
          Question {index + 1} of {total}
        </p>
        <h1 className="mt-5 text-3xl font-semibold leading-tight">
          {question}
        </h1>
        <div className="mt-8"><ActiveStaffControl teamMembers={teamMembers} value={teamMemberId} onChange={setTeamMemberId} label="Completing security check as" /></div>
        {last && (
          <>
            <p className="mt-10 font-semibold">
              Any security issues to report?
            </p>
            <div className="mt-3 grid gap-3">
              <Button
                variant="outline"
                className="h-14"
                onClick={() => setIssue("")}
              >
                No issues
              </Button>
              <Input
                value={issue}
                onChange={(event) => setIssue(event.target.value)}
                placeholder="Security issue / information to report"
                className="h-14"
              />
            </div>
          </>
        )}
        <Button
          aria-label="Mark complete"
          className="mt-10 h-16 w-full bg-[#2d7951] text-lg font-semibold text-white hover:bg-[#246442]"
          onClick={onSave}
          disabled={!teamMemberId}
        >
          <span className="sr-only">Mark complete</span>
          <Check className="size-6" />
        </Button>
      </main>
    </div>
  );
}
