import { useState } from "react";

function suggestedCorrectiveActions(context: string) {
  if (/clean|sanitis|wash/i.test(context)) return ["Recleaned and sanitised the area", "Removed equipment from use", "Informed the duty manager"];
  if (/security|lock|alarm/i.test(context)) return ["Secured the affected area", "Removed access until checked", "Informed the duty manager"];
  if (/temperature|fridge|probe|cook/i.test(context)) return ["Moved food to safe storage", "Continued cooking and arranged a recheck", "Removed affected food from sale", "Informed the duty manager"];
  return ["Removed the affected item from use", "Corrected the problem and checked again", "Informed the duty manager"];
}

/** Emits evidence only after deliberate confirmation. Other supports any business's procedure. */
export default function CorrectiveActionControl({ context, value, onChange, options }: { context: string; value: string; onChange: (value: string) => void; options?: string[] }) {
  const choices = options ?? suggestedCorrectiveActions(context);
  const [choice, setChoice] = useState(choices.includes(value) ? value : value ? "Other" : "");
  const [other, setOther] = useState(choices.includes(value) ? "" : value);
  const action = choice === "Other" ? other.trim() : choice;
  return <div className="mt-3 space-y-2"><label className="block text-sm font-semibold">Corrective action<select aria-label="Corrective action" className="mt-2 min-h-11 w-full rounded-xl border bg-white px-3" value={choice} onChange={event => { setChoice(event.target.value); onChange(""); }}><option value="">Select the action taken</option>{choices.map(item => <option key={item}>{item}</option>)}<option>Other</option></select></label>{choice === "Other" && <label className="block text-sm">Describe the action taken<textarea className="mt-2 min-h-16 w-full rounded-xl border bg-white p-3" value={other} onChange={event => { setOther(event.target.value); onChange(""); }} /></label>}<label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(value && value === action)} disabled={!action} onChange={event => onChange(event.target.checked ? action : "")} />I confirm this action has been taken</label></div>;
}
