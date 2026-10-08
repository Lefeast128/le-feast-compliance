import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ActiveStaffControl, StaffAttributionLine } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";

const dueLabel = (value: number) =>
  new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
type Props = {
  locationName: string;
  requirements: any[];
  completions: any[];
  teamMembers: any[];
  onComplete: (data: any) => Promise<void>;
  onBack: () => void;
};
export default function AdditionalChecksView({
  locationName,
  requirements,
  completions,
  teamMembers,
  onComplete,
  onBack,
}: Props) {
  const [selected, setSelected] = useState<any>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [member, setMember] = useState("");
  const [activeMemberId, setActiveMemberId] = useState("");
  const [certificate, setCertificate] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [now] = useState(() => Date.now());
  const doneCount = requirements.filter((requirement) => {
    const root = requirement.versionRootId ?? requirement._id;
    return (
      requirement.nextDueAt > now &&
      completions.some(
        (completion) =>
          completion.requirementRootId === root &&
          completion.nextDueAt === requirement.nextDueAt,
      )
    );
  }).length;
  async function submit() {
    const effectiveMember = member || activeMemberId;
    if (!selected || !effectiveMember) return;
    await onComplete({
      requirementId: selected._id,
      teamMemberId: effectiveMember,
      answers: Object.entries(values).map(([key, value]) => ({ key, value })),
      certificate,
      certificateReference: reference,
    });
    setSelected(null);
    setValues({});
    setMember("");
    setCertificate(null);
    setReference("");
  }
  return (
    <div className="min-h-screen bg-[#f6f7f5] text-[#171918]">
      <OperationalHeader
        title="Additional Checks"
        eyebrow="Recurring compliance"
        date={operationalDateLabel()}
        subtitle={locationName}
        onBack={onBack}
      />
      <main className="mx-auto max-w-2xl px-4 py-7 sm:px-6">
        <div className="mt-5">
          <ActiveStaffControl teamMembers={teamMembers} value={activeMemberId} onChange={setActiveMemberId} />
        </div>
        <div className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5">
          <div className="flex justify-between text-sm font-semibold">
            <span>
              {doneCount} / {requirements.length} tasks done
            </span>
            <span className="text-[#89918b]">Due or overdue</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#e7e9e5]">
            <div
              className="h-full rounded-full bg-[#ffde56]"
              style={{
                width: requirements.length
                  ? `${(doneCount / requirements.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {requirements.map((requirement) => (
            <button
              type="button"
              key={requirement._id}
              onClick={() => {
                setSelected(requirement);
                setValues({});
              }}
              className="flex w-full items-center justify-between rounded-2xl border border-black/[0.07] bg-white p-5 text-left"
            >
              <div>
                <p className="font-semibold">{requirement.title}</p>
                <p className="mt-1 text-sm text-[#727a74]">
                  {requirement.nextDueAt < now - 86400000
                    ? "⚠ Overdue"
                    : `Due ${dueLabel(requirement.nextDueAt)}`}
                </p>
              </div>
              <ChevronRight className="size-5 text-[#89918b]" />
            </button>
          ))}
          {!requirements.length && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#727a74]">
              No additional checks are due today.
            </div>
          )}
        </div>
        {selected && (
          <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">
                Additional check
              </p>
              <h2 className="mt-2 text-2xl font-semibold">{selected.title}</h2>
              <p className="mt-2 text-sm text-[#727a74]">
                {selected.description ?? `Due ${dueLabel(selected.nextDueAt)}`}
              </p>
              <div className="mt-6 space-y-4">
                {selected.fields.map((field: any) => {
                  if (field.type === "pdf") return null;
                  return (
                    <label
                      key={field.key}
                      className="block text-sm font-semibold"
                    >
                      {field.label}
                      {field.type === "yes_no" ? (
                        <select
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                        >
                          <option value="">Select answer</option>
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      ) : field.type === "completed" ? (
                        <select
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                        >
                          <option value="">Select status</option>
                          <option value="completed">Completed</option>
                        </select>
                      ) : field.type === "actions" && field.options?.length ? (
                        <select
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"
                        >
                          <option value="">Select action</option>
                          {field.options.map((option: string) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          type={
                            field.type === "date"
                              ? "date"
                              : field.type === "number" ||
                                  field.type === "temperature"
                                ? "number"
                                : "text"
                          }
                          step={
                            field.type === "temperature" ? "0.1" : undefined
                          }
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          className="mt-2 h-12"
                        />
                      )}
                    </label>
                  );
                })}
                {selected.fields.some((field: any) => field.type === "pdf") && (
                  <label className="block text-sm font-semibold">
                    Upload certificate / PDF
                    <input
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(event) =>
                        setCertificate(event.target.files?.[0] ?? null)
                      }
                      className="mt-2 block w-full rounded-xl border border-black/[0.1] p-3 text-sm"
                    />
                    <span className="mt-1 block text-xs font-normal text-[#89918b]">
                      {certificate?.name ?? "PDF required"}
                    </span>
                  </label>
                )}
                <label className="block text-sm font-semibold">
                  Certificate/reference number
                  <Input
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    className="mt-2 h-12"
                  />
                </label>
                <StaffAttributionLine value={member || activeMemberId} teamMembers={teamMembers} onChange={setMember} label="Change person for this additional check" />
              </div>
              <Button
                aria-label="Mark complete"
                disabled={
                  !(member || activeMemberId) ||
                  (selected.fields.some((field: any) => field.type === "pdf") &&
                    !certificate)
                }
                className="mt-7 h-14 w-full bg-[#2d7951] text-lg font-semibold text-white hover:bg-[#246442]"
                onClick={submit}
              >
                <span className="sr-only">Mark complete</span>
                <Check className="size-6" />
              </Button>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => setSelected(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
