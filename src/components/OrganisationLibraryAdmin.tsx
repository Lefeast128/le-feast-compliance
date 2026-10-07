import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentsApi, restApi, useRestMutation, useRestQueryState } from "@/lib/rest-domain";
import { Pencil, RefreshCw, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Store = { id: string; name: string; shortName: string };
type LibraryAdminDocument = {
  id: string;
  title: string;
  description?: string | null;
  category: string;
  important: boolean;
  allocationMode: "all" | "selected";
  locationIds: string[];
  stores: string[];
  active: boolean;
  version: number;
  attachmentStatus?: Array<{ locationId: string; store: string; status: "attached" | "missing" }>;
};
type LibraryAdminResponse = { locations: Store[]; documents: LibraryAdminDocument[] };

const emptyStores = (locations: Store[]) => Object.fromEntries(locations.map(location => [location.id, false]));

export default function OrganisationLibraryAdmin() {
  const query = useRestQueryState<LibraryAdminResponse>("organisation-library", restApi.admin.organisation.library.list, true);
  const { data, loading, error, retry } = query;
  const publish = useRestMutation(restApi.admin.organisation.library.publish);
  const update = useRestMutation(restApi.admin.organisation.library.update);
  const replace = useRestMutation(restApi.admin.organisation.library.replace);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("food_safety_eho");
  const [important, setImportant] = useState(false);
  const [allStores, setAllStores] = useState(true);
  const [stores, setStores] = useState<Record<string, boolean>>({});
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setEditId(null);
    setTitle("");
    setDescription("");
    setCategory("food_safety_eho");
    setImportant(false);
    setAllStores(true);
    setStores(emptyStores(data?.locations ?? []));
    setFile(null);
  }

  function edit(item: LibraryAdminDocument) {
    setEditId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setCategory(item.category);
    setImportant(item.important);
    setAllStores(item.allocationMode === "all");
    setStores(Object.fromEntries((data?.locations ?? []).map(location => [location.id, item.locationIds.includes(location.id)])));
    setFile(null);
  }

  async function save() {
    const locationIds = Object.keys(stores).filter(id => stores[id]);
    if (!title.trim() || (!allStores && !locationIds.length) || (!editId && !file)) {
      toast.error(editId ? "Complete the library document details" : "Select a PDF before publishing");
      return;
    }
    const anchor = (allStores ? data?.locations[0]?.id : locationIds[0]) ?? "";
    if (!anchor) {
      toast.error("No active store is available");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await update({ libraryDocumentId: editId, title: title.trim(), description, category, important, allStores, locationIds });
        if (file) {
          const uploaded = await documentsApi.upload({ locationId: anchor, file, purpose: "library_document" });
          await replace({ libraryDocumentId: editId, documentId: uploaded.id ?? uploaded._id });
        }
        toast.success(file ? "Library document updated and PDF replaced" : "Library document updated");
      } else {
        const uploaded = await documentsApi.upload({ locationId: anchor, file, purpose: "library_document" });
        await publish({ title: title.trim(), description, category, important, allStores, locationIds, documentId: uploaded.id ?? uploaded._id });
        toast.success("Library document published");
      }
      reset();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save library document");
    } finally {
      setSaving(false);
    }
  }

  async function retire(item: LibraryAdminDocument) {
    if (!window.confirm("Retire this library document? Previous versions will remain available in audit history.")) return;
    try {
      await update({ libraryDocumentId: item.id, retire: true });
      toast.success("Library document retired");
    } catch (retireError) {
      toast.error(retireError instanceof Error ? retireError.message : "Unable to retire library document");
    }
  }

  if (loading || (!data && !error)) {
    return <section className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#727a74]">Loading Document Library…</section>;
  }

  if (error) {
    return <section className="rounded-2xl border border-[#efc8c3] bg-white p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b64738]">Document Library</p><h2 className="mt-2 text-xl font-semibold">Document Library couldn&apos;t be loaded.</h2><p className="mt-2 text-sm text-[#727a74]">Please try again. Your existing documents have not been changed.</p><Button variant="outline" className="mt-5" onClick={retry}><RefreshCw className="mr-2 size-4" />Try again</Button></section>;
  }

  if (!data) return null;

  return <section className="rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Document Library</p><h2 className="mt-1 text-xl font-semibold">Store reference documents</h2><p className="mt-1 text-sm text-[#727a74]">Reference PDFs are visible to authorised staff without training acknowledgement.</p></div><Button variant="ghost" size="icon" onClick={reset} aria-label="Reset document library form"><Upload className="size-4" /></Button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Title<Input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3"><option value="food_safety_eho">Food Safety &amp; EHO</option><option value="store_station">Store &amp; Station</option><option value="health_safety">Health &amp; Safety</option><option value="policies_procedures">Policies &amp; Procedures</option><option value="other">Other</option></select></label><label className="text-sm font-semibold md:col-span-2">Description<textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-2 min-h-24 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={important} onChange={event => setImportant(event.target.checked)} /> Mark as Important</label><label className="text-sm font-semibold">PDF{editId ? " (optional replacement)" : ""}<input type="file" accept="application/pdf" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /><span className="mt-1 block text-xs font-normal text-[#89918b]">PDF · Maximum 25 MB</span></label><div className="md:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allStores} onChange={event => setAllStores(event.target.checked)} /> All stores</label>{!allStores && <div className="mt-2 grid gap-2 sm:grid-cols-2">{data.locations.map(location => <label key={location.id} className="flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(stores[location.id])} onChange={() => setStores({ ...stores, [location.id]: !stores[location.id] })} />{location.name}</label>)}</div>}</div></div><div className="mt-5 flex gap-2"><Button className="bg-[#202522] text-white" disabled={saving} onClick={() => void save()}>{saving && file ? "Uploading PDF…" : editId ? "Save document" : "Publish document"}</Button>{editId && <Button variant="outline" onClick={reset}>Cancel edit</Button>}</div><div className="mt-6 space-y-2">{data.documents.length === 0 && <div className="rounded-xl border border-dashed border-black/[0.1] bg-[#fafbf9] p-5 text-center text-sm text-[#727a74]">No documents have been published yet.</div>}{data.documents.map(item => <div key={item.id} className={`rounded-xl bg-[#fafbf9] p-3 text-sm ${!item.active ? "opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title} {item.important && <span className="rounded-full bg-[#fff7dc] px-2 py-1 text-[10px] text-[#8a6b12]">Important</span>}</p><p className="text-xs text-[#727a74]">{item.active ? (item.allocationMode === "all" ? "All active stores" : item.stores.join(", ")) : "Retired"} · Version {item.version}</p><div className="mt-2 flex flex-wrap gap-2 text-xs">{(item.attachmentStatus ?? []).map(status => <span key={status.locationId} className={`rounded-full px-2 py-1 ${status.status === "attached" ? "bg-[#e9f5ec] text-[#2d7951]" : "bg-[#fff2df] text-[#9a5b16]"}`}>{status.store} — {status.status === "attached" ? "Attached" : "Missing"}</span>)}</div></div>{item.active && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={`Edit ${item.title}`} onClick={() => edit(item)}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" className="text-[#b64738]" aria-label={`Retire ${item.title}`} onClick={() => void retire(item)}><Trash2 className="size-4" /></Button></div>}</div></div>)}</div></section>;
}
