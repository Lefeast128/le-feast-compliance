import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminEditor, AdminEditorValues, AdminEquipment, AdminQuestion, AdminTeamEditorMember, FridgeEditorState, FridgeEditorValues } from "@/components/admin/admin-types";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

type ListCardProps = {
  title: string;
  action?: string;
  onAdd: () => void;
  onExport?: () => void;
  children: ReactNode;
};

export function ListCard({ title, action, onAdd, onExport, children }: ListCardProps) {
  if (title === "Wastage List") return <section className="rounded-2xl border border-[#f0d98a] bg-[#fffdf4] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="text-lg font-semibold">Wastage catalogue</h2><p className="mt-1 text-sm text-[#727a74]">TouchOffice products · decide what staff can record as wastage.</p></div><Button className="bg-[#202522] text-white" onClick={onAdd}>Manage catalogue <Pencil className="ml-2 size-4" /></Button></div><p className="mt-4 text-xs text-[#89918b]">The legacy manual item list remains supported for historical records but is no longer the primary staff picker.</p></section>;
  return <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">{title}</h2><div className="flex gap-2"><Button size="sm" className="bg-[#202522] text-white" onClick={onAdd}><Plus className="mr-1 size-4" /> {action}</Button>{onExport && <Button size="sm" variant="outline" onClick={onExport}>Export CSV</Button>}</div></div><div className="mt-4">{children}</div></section>;
}

type QuestionListProps = {
  items: AdminQuestion[];
  onEdit: (item: AdminQuestion) => void;
  onDelete: (id: string) => void | Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void | Promise<void>;
};

export function QuestionList({ items, onEdit, onDelete, onMove }: QuestionListProps) {
  return <div className="space-y-2">{items.map((item, index) => <div key={item._id} className="flex items-start justify-between gap-2 rounded-xl bg-[#fafbf9] px-3 py-3 text-sm"><span><span className="mr-2 text-[#89918b]">{index + 1}.</span>{item.question}</span><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" onClick={() => onMove(item._id, "up")}><ChevronUp className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => onMove(item._id, "down")}><ChevronDown className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => onEdit(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" onClick={() => onDelete(item._id)}><Trash2 className="size-4" /></Button></div></div>)}{!items.length && <p className="text-sm text-[#89918b]">No active questions.</p>}</div>;
}

type FridgeEditorProps = {
  editor: FridgeEditorState;
  currentCount: number;
  onClose: () => void;
  onSave: (values: FridgeEditorValues) => void | Promise<void>;
};

export function FridgeEditor({ editor, currentCount, onClose, onSave }: FridgeEditorProps) {
  const [count, setCount] = useState(String(currentCount));
  const [minimum, setMinimum] = useState(String(editor.item?.minimumTemperature ?? 0));
  const [preferred, setPreferred] = useState(String(editor.item?.preferredTemperature ?? 5));
  const [maximum, setMaximum] = useState(String(editor.item?.maximumTemperature ?? 8));
  const limits = editor.kind === "limits";
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{limits ? `Edit Fridge ${editor.item ? "limits" : ""}` : "Set fridge count"}</h2><Button variant="ghost" size="icon" onClick={onClose}>×</Button></div>{limits ? <div className="mt-6 grid grid-cols-3 gap-3"><label className="text-sm font-semibold">Minimum °C<Input type="number" step="0.1" value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-2 h-12" /></label><label className="text-sm font-semibold">Preferred °C<Input type="number" step="0.1" value={preferred} onChange={(event) => setPreferred(event.target.value)} className="mt-2 h-12" /></label><label className="text-sm font-semibold">Maximum °C<Input type="number" step="0.1" value={maximum} onChange={(event) => setMaximum(event.target.value)} className="mt-2 h-12" /></label></div> : <label className="mt-6 block text-sm font-semibold">Number of active fridges<Input type="number" min="1" value={count} onChange={(event) => setCount(event.target.value)} className="mt-2 h-12" /></label>}<Button className="mt-6 h-12 w-full bg-[#ffde56] text-[#171717]" onClick={() => onSave(limits ? { minimum, preferred, maximum } : { count })}>Save fridge setup</Button></div></div>;
}

type TeamEditorProps = {
  member?: AdminTeamEditorMember;
  onClose: () => void;
  onSave: (name: string, memberId?: string, role?: "team" | "manager") => void | Promise<void>;
};

export function TeamEditor({ member, onClose, onSave }: TeamEditorProps) {
  const existing = member && member !== true ? member : undefined;
  const [name, setName] = useState(existing?.name ?? "");
  const [role, setRole] = useState<"team" | "manager">(existing?.role === "manager" ? "manager" : "team");
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5"><div className="w-full max-w-lg rounded-t-3xl bg-white p-6 sm:rounded-3xl sm:p-8"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{existing ? "Edit team member" : "Add team member"}</h2><Button variant="ghost" size="icon" onClick={onClose}>×</Button></div><label className="mt-6 block text-sm font-semibold">Staff member name<Input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-12" placeholder="James Smith" /></label><label className="mt-4 block text-sm font-semibold">Role<select value={role} onChange={(event) => setRole(event.target.value as "team" | "manager")} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="team">Team member</option><option value="manager">Manager</option></select></label><Button disabled={!name.trim()} className="mt-6 h-12 w-full bg-[#ffde56] text-[#171717]" onClick={() => onSave(name, existing?._id, role)}>Save member</Button></div></div>;
}

export type { AdminEditor, AdminEditorValues, AdminEquipment };
