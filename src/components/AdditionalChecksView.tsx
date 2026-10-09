import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ActiveStaffControl, StaffAttributionLine } from "@/components/dashboard/StaffAttribution";
import OperationalHeader from "@/components/dashboard/OperationalHeader";
import { operationalDateLabel } from "@/lib/operational-date";
import { additionalCheckHasFailure } from "@/shared/additional-check-validation";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const selectedValues = selected ? values : {};
  const hasFailedValue = selected ? additionalCheckHasFailure(selected.fields, selectedValues) : false;
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
    if (!selected || !effectiveMember || saving) return;
    setSaving(true);
    setError(null);
    try {
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
    } catch (completeError) {
      setError(completeError instanceof Error ? completeError.message : "This check could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="min-h-screen bg-white text-[#171918]">
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
              className="h-full rounded-full bg-brand-yellow"
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
                setError(null);
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
                  if (field.type === "actions" && !hasFailedValue) return null;
                  return (
                    <label
                      key={field.key}
                      className="block text-sm font-semibold"
                    >
                      <>{field.label}{(field.type === "temperature" || field.type === "number") && (field.minimum !== undefined || field.maximum !== undefined) && <span className="mt-1 block text-xs font-normal text-[#727a74]">Acceptable range: {field.minimum ?? "no minimum"}–{field.maximum ?? "no maximum"}{field.type === "temperature" ? " °C" : ""}</span>}</>
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
                {hasFailedValue && <label className="block text-sm font-semibold">
                  Corrective Action Taken
                  <textarea required value={reference} onChange={(event) => setReference(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" placeholder="Describe what was done to address the failed reading" />
                </label>}
                <StaffAttributionLine value={member || activeMemberId} teamMembers={teamMembers} onChange={setMember} label="Change person for this additional check" />
              </div>
              {error && <p role="alert" className="mt-4 rounded-xl border border-[#efc8c3] bg-[#fff8f6] p-3 text-sm text-[#8f3a31]">{error}</p>}
              <Button
                aria-label="Complete additional check"
                disabled={
                  saving ||
                  !(member || activeMemberId) ||
                  (hasFailedValue && !reference.trim()) ||
                  (selected.fields.some((field: any) => field.type === "pdf") &&
                    !certificate)
                }
                className="mt-7 h-14 w-full bg-[#2d7951] text-lg font-semibold text-white hover:bg-[#246442]"
                onClick={submit}
              >
                {saving ? "Saving…" : "Complete check"}
                <Check className="ml-2 size-5" />
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
