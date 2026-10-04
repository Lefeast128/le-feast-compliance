import type { UserAccessResponse, UserAccessRole, UserAccessUser } from "@/lib/rest-domain";
import { restApi, useRestMutation, useRestQuery } from "@/lib/rest-domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Editor = { mode: "invite" | "edit"; user?: UserAccessUser };
type SelectedStores = Record<string, UserAccessRole>;

const roleLabel = (role: UserAccessRole) => role === "manager" ? "Manager" : "Staff";

const accessRoleLabel = (user: UserAccessUser) => {
  if (user.role === "admin") return "Organisation Admin";
  const roles = [...new Set(user.memberships.map(membership => membership.role))];
  return roles.length ? roles.map(roleLabel).join(" / ") : "No store role";
};

function selectionsFor(user: UserAccessUser): SelectedStores {
  return Object.fromEntries(user.memberships.map(membership => [membership.id, membership.role]));
}

export default function UserAccessAdmin({ visible = true }: { visible?: boolean }) {
  const data = useRestQuery<UserAccessResponse>(visible ? "user-access" : null, restApi.admin.userAccess.list, visible);
  const invite = useRestMutation(restApi.admin.userAccess.invite);
  const update = useRestMutation(restApi.admin.userAccess.update);
  const resend = useRestMutation(restApi.admin.userAccess.resend);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserAccessRole>("staff");
  const [selectedStores, setSelectedStores] = useState<SelectedStores>({});
  const [saving, setSaving] = useState(false);

  if (!visible || !data) return null;

  function openInvite() {
    setEditor({ mode: "invite" });
    setName("");
    setEmail("");
    setRole("staff");
    setSelectedStores({});
  }

  function openEdit(user: UserAccessUser) {
    setEditor({ mode: "edit", user });
    setName(user.name ?? "");
    setEmail(user.email);
    setRole(user.memberships[0]?.role ?? "staff");
    setSelectedStores(selectionsFor(user));
  }

  function closeEditor() {
    setEditor(null);
    setSaving(false);
  }

  function setStoreSelected(locationId: string, checked: boolean) {
    setSelectedStores(current => {
      const next = { ...current };
      if (checked) next[locationId] = role;
      else delete next[locationId];
      return next;
    });
  }

  function changeRole(nextRole: UserAccessRole) {
    setRole(nextRole);
    setSelectedStores(current => Object.fromEntries(Object.keys(current).map(locationId => [locationId, nextRole])));
  }

  async function save() {
    if (!editor || !name.trim()) return;
    const memberships = Object.entries(selectedStores).map(([locationId, selectedRole]) => ({ locationId, role: selectedRole }));
    if (!memberships.length) {
      toast.error(editor.mode === "invite" ? "Select at least one store" : "Select at least one store or use the existing account without access");
      if (editor.mode === "invite") return;
    }
    setSaving(true);
    try {
      if (editor.mode === "invite") await invite({ name: name.trim(), email: email.trim(), role, locations: memberships });
      else if (editor.user) await update({ userId: editor.user.id, name: name.trim(), memberships });
      toast.success(editor.mode === "invite" ? "Invitation sent" : "User access updated");
      closeEditor();
    } catch (error) {
      window.dispatchEvent(new Event("rest:data-changed"));
      setSaving(false);
      toast.error(error instanceof Error ? error.message : "Unable to save user access");
    }
  }

  async function sendAgain(user: UserAccessUser) {
    try {
      await resend({ userId: user.id });
      toast.success("Invitation resent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to resend invitation");
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-black/[0.07] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Organisation access</p>
          <h2 className="mt-1 text-xl font-semibold">User Access</h2>
          <p className="mt-1 text-sm text-[#727a74]">Manage login accounts and the stores they can access.</p>
        </div>
        <Button className="bg-[#202522] text-white" onClick={openInvite}><Plus className="mr-1 size-4" /> Invite user</Button>
      </div>

      <div className="mt-5 divide-y divide-black/[0.07] rounded-xl border border-black/[0.07]">
        {data.users.map(user => (
          <div key={user.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{user.name || "Unnamed user"}</p>
              <p className="truncate text-sm text-[#727a74]">{user.email}</p>
            </div>
            <div className="text-sm">
              <p className="font-medium">{accessRoleLabel(user)}</p>
              <p className="text-[#727a74]">
                {user.allOrganisationLocations
                  ? "All stores"
                  : user.memberships.length
                    ? user.memberships.map(membership => `${membership.name} (${roleLabel(membership.role)})`).join(", ")
                    : "No store access"}
              </p>
            </div>
            {user.role === "admin" ? (
              <span className="rounded-full bg-[#edf3ed] px-3 py-1 text-xs font-semibold text-[#3f6046]">Protected</span>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label={`Edit ${user.email}`} onClick={() => openEdit(user)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" aria-label={`Resend invitation to ${user.email}`} onClick={() => sendAgain(user)}><RefreshCw className="size-4" /></Button>
              </div>
            )}
          </div>
        ))}
        {!data.users.length && <p className="p-4 text-sm text-[#727a74]">No user access accounts found.</p>}
      </div>

      <div className="mt-6 rounded-xl border border-black/[0.07] bg-[#fafbf9] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Access history</p>
        <div className="mt-3 space-y-3">
          {data.accessHistory.map((event, index) => (
            <div key={`${event.occurredAt}:${event.userEmail}:${index}`} className="rounded-xl bg-white p-3 text-sm">
              <p className="font-semibold">{new Date(event.occurredAt).toLocaleString("en-GB")}</p>
              <p className="mt-1 text-[#727a74]">{event.adminName} · {event.userName}{event.userEmail ? ` (${event.userEmail})` : ""}</p>
              <p className="mt-1">{event.change}</p>
            </div>
          ))}
          {!data.accessHistory.length && <p className="text-sm text-[#727a74]">No access changes recorded yet.</p>}
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{editor.mode === "invite" ? "Invite user" : "Edit user access"}</h2>
                <p className="mt-1 text-sm text-[#727a74]">Store access is separate from operational Team Members.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={closeEditor}><X className="size-5" /></Button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">Name<Input value={name} onChange={event => setName(event.target.value)} className="mt-2 h-12" /></label>
              <label className="block text-sm font-semibold">Email<Input type="email" value={email} disabled={editor.mode === "edit"} onChange={event => setEmail(event.target.value)} className="mt-2 h-12" /></label>
              <div>
                <p className="text-sm font-semibold">Store access</p>
                <div className="mt-2 space-y-2">
                  {data.locations.map(location => (
                    <label key={location.id} className="flex items-center gap-3 rounded-xl border border-black/[0.08] px-3 py-3 text-sm">
                      <input type="checkbox" checked={selectedStores[location.id] !== undefined} onChange={event => setStoreSelected(location.id, event.target.checked)} />
                      <span className="flex-1">{location.name}</span>
                      {selectedStores[location.id] !== undefined && <span className="text-xs text-[#727a74]">{roleLabel(selectedStores[location.id])}</span>}
                    </label>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-semibold">Role for selected stores<select value={role} onChange={event => changeRole(event.target.value as UserAccessRole)} className="mt-2 h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
              <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={closeEditor}>Cancel</Button><Button className="bg-[#202522] text-white" disabled={saving || !name.trim() || !email.trim()} onClick={save}>{saving ? "Saving…" : editor.mode === "invite" ? "Invite user" : "Save access"}</Button></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
