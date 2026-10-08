import { UserRound } from "lucide-react";
import { useState } from "react";

export type AttributionMember = { _id: string; name: string };

type ActiveStaffControlProps = {
  teamMembers: AttributionMember[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

/** Shared active-person control for operational workflows. */
export function ActiveStaffControl({
  teamMembers,
  value,
  onChange,
  label = "Completing as",
}: ActiveStaffControlProps) {
  const selectedName = teamMembers.find((member) => member._id === value)?.name;
  return (
    <section className="rounded-2xl border border-black/[0.07] bg-white p-4 shadow-[0_4px_16px_rgba(23,25,24,0.04)]" aria-label={label}>
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff7c9] text-[#796513]">
          <UserRound className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#89918b]">{label}</p>
          <p className="mt-0.5 text-sm text-[#59625c]">{selectedName ?? "Select a team member before saving"}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Active team member">
        {teamMembers.length <= 4 ? teamMembers.map((member) => (
          <button
            key={member._id}
            type="button"
            role="radio"
            aria-checked={value === member._id}
            onClick={() => onChange(member._id)}
            className={`min-h-10 rounded-full border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde56] ${value === member._id ? "border-[#202522] bg-[#202522] text-white" : "border-black/[0.1] bg-white text-[#303631] hover:bg-[#fffdf4]"}`}
          >
            {member.name}
          </button>
        )) : (
          <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm font-semibold outline-none focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40"
            aria-label="Active team member"
          >
            <option value="">Select team member</option>
            {teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
          </select>
        )}
      </div>
    </section>
  );
}

type StaffAttributionLineProps = {
  value: string;
  teamMembers: AttributionMember[];
  onChange: (value: string) => void;
  label?: string;
  className?: string;
};

/** Compact override control; the picker is only rendered after Change is tapped. */
export function StaffAttributionLine({
  value,
  teamMembers,
  onChange,
  label = "Change person",
  className = "",
}: StaffAttributionLineProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const memberName = teamMembers.find((member) => member._id === value)?.name ?? "Not selected";
  return (
    <div className={`rounded-xl border border-black/[0.06] bg-[#f6f7f5] px-3 py-2 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-xs text-[#59625c]">
        <span className="min-w-0 truncate">Signed by: <strong className={value ? "font-semibold text-[#303631]" : "font-semibold text-[#8f3a31]"}>{memberName}</strong></span>
        <button
          type="button"
          onClick={() => setPickerOpen((current) => !current)}
          aria-expanded={pickerOpen}
          aria-label={label}
          className="shrink-0 rounded-lg px-2 py-1 font-semibold text-[#796513] transition hover:bg-[#fff7c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffde56]"
        >
          Change
        </button>
      </div>
      {pickerOpen && (
        <select
          autoFocus
          value={value}
          onChange={(event) => { onChange(event.target.value); setPickerOpen(false); }}
          className="mt-2 h-10 w-full rounded-lg border border-black/[0.1] bg-white px-3 text-sm font-medium text-[#171918] outline-none transition focus:border-[#b49b2f] focus:ring-2 focus:ring-[#ffde56]/40"
          aria-label={label}
        >
          <option value="">Select team member</option>
          {teamMembers.map((member) => <option key={member._id} value={member._id}>{member.name}</option>)}
        </select>
      )}
    </div>
  );
}
