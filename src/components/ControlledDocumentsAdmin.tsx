import { PdfDropzone } from "@/components/PdfDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { documentsApi, restApi, useRestMutation, useRestQueryState } from "@/lib/rest-domain";
import { LIBRARY_CATEGORY_OPTIONS, libraryCategoryLabel } from "@/shared/library-categories";
import { FileCheck2, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Store = { id: string; name: string; shortName: string };
type ControlledDocument = {
  id: string; title: string; description?: string | null; category: string;
  allocationMode: "all" | "selected"; locationIds: string[]; stores: Store[];
  displayInLibrary: boolean; requireTrainingAcknowledgement: boolean;
  acknowledgementDeadline?: string | null; publicationDate?: string | null;
  reviewDate?: string | null; version: number; active: boolean;
};
type Response = { locations: Store[]; documents: ControlledDocument[] };
type AcknowledgementMember = { teamMemberId: string; name: string; completedAt: string | null };
type AcknowledgementStore = { id: string; name: string; acknowledged: AcknowledgementMember[] };
type AcknowledgementOverview = { version: number | null; stores: AcknowledgementStore[] };

const blankStores = (stores: Store[]) => Object.fromEntries(stores.map(store => [store.id, false]));

export default function ControlledDocumentsAdmin() {
  const query = useRestQueryState<Response>("controlled-documents", restApi.admin.organisation.controlledDocuments.list, true);
  const { data, loading, error, retry } = query;
  const create = useRestMutation(restApi.admin.organisation.controlledDocuments.create);
  const update = useRestMutation(restApi.admin.organisation.controlledDocuments.update);
  const replace = useRestMutation(restApi.admin.organisation.controlledDocuments.replace);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("eho_food_safety_certificates");
  const [allStores, setAllStores] = useState(true);
  const [stores, setStores] = useState<Record<string, boolean>>({});
  const [displayInLibrary, setDisplayInLibrary] = useState(true);
  const [requireAcknowledgement, setRequireAcknowledgement] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [publicationDate, setPublicationDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [overview, setOverview] = useState<AcknowledgementOverview | null>(null);

  function reset() {
    setEditId(null); setTitle(""); setDescription(""); setCategory("eho_food_safety_certificates");
    setAllStores(true); setStores(blankStores(data?.locations ?? [])); setDisplayInLibrary(true);
    setRequireAcknowledgement(false); setDeadline(""); setPublicationDate(""); setReviewDate(""); setFile(null);
  }
  function edit(item: ControlledDocument) {
    setEditId(item.id); setTitle(item.title); setDescription(item.description ?? ""); setCategory(item.category);
    setAllStores(item.allocationMode === "all"); setStores(Object.fromEntries((data?.locations ?? []).map(store => [store.id, item.locationIds.includes(store.id)])));
    setDisplayInLibrary(item.displayInLibrary); setRequireAcknowledgement(item.requireTrainingAcknowledgement);
    setDeadline(item.acknowledgementDeadline?.slice(0, 10) ?? ""); setPublicationDate(item.publicationDate?.slice(0, 10) ?? ""); setReviewDate(item.reviewDate?.slice(0, 10) ?? ""); setFile(null);
  }
  async function save() {
    const locationIds = Object.keys(stores).filter(id => stores[id]);
    if (!title.trim() || (!allStores && !locationIds.length) || (!editId && !file)) { toast.error(editId ? "Complete the controlled document details" : "Select a PDF before publishing"); return; }
    const anchor = (allStores ? data?.locations[0]?.id : locationIds[0]) ?? "";
    if (!anchor) { toast.error("No active store is available"); return; }
    setSaving(true);
    try {
      const body = { title: title.trim(), description, category, allStores, locationIds, displayInLibrary, requireTrainingAcknowledgement: requireAcknowledgement, acknowledgementDeadline: deadline || null, publicationDate: publicationDate || null, reviewDate: reviewDate || null };
      if (editId) {
        await update({ controlledDocumentId: editId, ...body });
        if (file) { const uploaded = await documentsApi.upload({ locationId: anchor, file, purpose: "library_document" }); await replace({ controlledDocumentId: editId, documentId: uploaded.id ?? uploaded._id, locationIds, allocationMode: allStores ? "all" : "selected", publicationDate: publicationDate || null, reviewDate: reviewDate || null, requireReacknowledgement: requireAcknowledgement }); }
        toast.success(file ? "Controlled document updated and version published" : "Controlled document updated");
      } else {
        const uploaded = await documentsApi.upload({ locationId: anchor, file, purpose: "library_document" });
        await create({ ...body, documentId: uploaded.id ?? uploaded._id });
        toast.success("Controlled document published");
      }
      reset();
    } catch (saveError) { toast.error(saveError instanceof Error ? saveError.message : "Unable to save controlled document"); } finally { setSaving(false); }
  }
  async function retire(item: ControlledDocument) {
    if (!window.confirm(`Retire ${item.title}? Historical versions and acknowledgements will remain available.`)) return;
    try { await update({ controlledDocumentId: item.id, retire: true }); toast.success("Controlled document retired"); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to retire document"); }
  }
  async function showOverview(item: ControlledDocument) {
    try { setOverview(await restApi.admin.organisation.controlledDocuments.acknowledgements({ controlledDocumentId: item.id }) as AcknowledgementOverview); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to load acknowledgement overview"); }
  }
  if (loading || (!data && !error)) return <section className="rounded-2xl border border-black/[0.07] bg-white p-5 text-sm text-[#727a74]">Loading Controlled Documents…</section>;
  if (error) return <section className="rounded-2xl border border-[#efc8c3] bg-white p-6"><p className="font-semibold">Controlled Documents couldn&apos;t be loaded.</p><p className="mt-2 text-sm text-[#727a74]">Please try again. Existing documents have not been changed.</p><Button variant="outline" className="mt-4" onClick={retry}><RefreshCw className="mr-2 size-4" />Try again</Button></section>;
  if (!data) return null;
  const options = category && !LIBRARY_CATEGORY_OPTIONS.some(item => item.value === category) ? [{ value: category, label: libraryCategoryLabel(category) }, ...LIBRARY_CATEGORY_OPTIONS] : LIBRARY_CATEGORY_OPTIONS;
  return <section className="rounded-2xl border border-black/[0.07] bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Controlled Documents</p><h2 className="mt-1 text-xl font-semibold">Publish once, use everywhere</h2><p className="mt-1 max-w-2xl text-sm text-[#727a74]">One private PDF can be published to Library, Training, or both. Versions and acknowledgements remain immutable.</p></div><Button variant="ghost" size="icon" onClick={reset} aria-label="New controlled document"><Upload className="size-4" /></Button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm font-semibold">Title<Input value={title} onChange={event => setTitle(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Category<select value={category} onChange={event => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="text-sm font-semibold md:col-span-2">Description<textarea value={description} onChange={event => setDescription(event.target.value)} className="mt-2 min-h-20 w-full rounded-xl border border-black/[0.1] p-3" /></label><label className="text-sm font-semibold">Publication date<Input type="date" value={publicationDate} onChange={event => setPublicationDate(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">Review date<Input type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} className="mt-2 h-11" /></label><label className="text-sm font-semibold">PDF{editId ? " (optional replacement)" : ""}<PdfDropzone onFile={setFile} /><span className="mt-1 block text-xs font-normal text-[#89918b]">PDF · Maximum 100 MB</span></label><div className="space-y-3 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={displayInLibrary} onChange={event => setDisplayInLibrary(event.target.checked)} /> Display in Library</label><label className="flex items-center gap-2"><input type="checkbox" checked={requireAcknowledgement} onChange={event => setRequireAcknowledgement(event.target.checked)} /> Require Training acknowledgement</label>{requireAcknowledgement && <label className="block font-semibold">Acknowledgement deadline<Input type="date" value={deadline} onChange={event => setDeadline(event.target.value)} className="mt-2 h-11" /></label>}</div><div className="md:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allStores} onChange={event => setAllStores(event.target.checked)} /> Apply to all active stores</label>{!allStores && <div className="mt-2 grid gap-2 sm:grid-cols-2">{data.locations.map(location => <label key={location.id} className="flex items-center gap-2 rounded-xl border border-black/[0.08] px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(stores[location.id])} onChange={() => setStores({ ...stores, [location.id]: !stores[location.id] })} />{location.name}</label>)}</div>}</div></div>
    <div className="mt-5 flex gap-2"><Button className="bg-brand-yellow text-[#171717]" disabled={saving} onClick={() => void save()}>{saving && file ? "Uploading PDF…" : editId ? "Save document" : "Publish document"}</Button>{editId && <Button variant="outline" onClick={reset}>Cancel edit</Button>}</div>
    <div className="mt-6 space-y-2">{data.documents.map(item => <div key={item.id} className={`rounded-xl border border-black/[0.07] bg-white p-4 ${!item.active ? "opacity-60" : ""}`}><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-[#727a74]">{libraryCategoryLabel(item.category)} · Version {item.version} · {item.active ? item.stores.map(store => store.name).join(", ") : "Retired"}</p><div className="mt-2 flex flex-wrap gap-2 text-xs">{item.displayInLibrary && <span className="rounded-full bg-[#fff8d7] px-2 py-1"><FileCheck2 className="mr-1 inline size-3" />Library</span>}{item.requireTrainingAcknowledgement && <span className="rounded-full bg-[#fff8d7] px-2 py-1"><ShieldCheck className="mr-1 inline size-3" />Training acknowledgement</span>}{item.reviewDate && <span className="rounded-full bg-[#f5f5f5] px-2 py-1">Review {item.reviewDate.slice(0, 10)}</span>}</div></div>{item.active && <div className="flex flex-wrap justify-end gap-1"><Button variant="outline" size="sm" onClick={() => edit(item)}>Edit</Button>{item.requireTrainingAcknowledgement && <Button variant="outline" size="sm" onClick={() => void showOverview(item)}>Acknowledgements</Button>}<Button variant="ghost" size="sm" className="text-[#b64738]" onClick={() => void retire(item)}>Retire</Button></div>}</div></div>)}{!data.documents.length && <div className="rounded-xl border border-dashed border-black/[0.1] p-5 text-center text-sm text-[#727a74]">No controlled documents published yet.</div>}</div>
    {overview && <div className="mt-5 rounded-2xl border border-black/[0.07] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#89918b]">Acknowledgement overview</p><h3 className="mt-1 text-lg font-semibold">Version {overview.version ?? "—"}</h3><p className="mt-1 text-sm text-[#727a74]">Acknowledgements are recorded against the exact published version.</p></div><Button variant="ghost" size="sm" onClick={() => setOverview(null)}>Close</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{overview.stores.map(store => { const acknowledged = store.acknowledged.filter(member => member.completedAt).length; return <div key={store.id} className="rounded-xl border border-black/[0.07] p-4"><p className="font-semibold">{store.name}</p><p className="mt-1 text-sm text-[#727a74]">{acknowledged} of {store.acknowledged.length} acknowledged</p><div className="mt-3 space-y-1 text-xs">{store.acknowledged.map(member => <p key={member.teamMemberId} className={member.completedAt ? "text-[#2d7951]" : "text-[#b64738]"}>{member.name} · {member.completedAt ? `Acknowledged ${new Date(member.completedAt).toLocaleDateString("en-GB")}` : "Outstanding"}</p>)}</div></div>; })}</div></div>}
  </section>;
}
